import { createHash, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { FIELD_BY_ID } from "../src/exhibition-schema.js";

const originAllowed = (origin) =>
  !origin ||
  (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) ||
  [
    "https://douglass-exhibition.vercel.app",
    "https://n4tem4rsh4ll.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].includes(origin);
function authorized(req) {
  const hash = process.env.EDITOR_SECRET_HASH;
  const header = req.headers.authorization || "";
  if (
    !hash ||
    !/^[a-f0-9]{64}$/.test(hash) ||
    !header.startsWith("Bearer ") ||
    header.length > 500
  )
    return false;
  const provided = createHash("sha256").update(header.slice(7)).digest();
  return timingSafeEqual(provided, Buffer.from(hash, "hex"));
}
async function bodyOf(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body) > 20000)
        throw new Error("Request too large");
      return JSON.parse(req.body);
    }
    if (Buffer.byteLength(JSON.stringify(req.body)) > 20000)
      throw new Error("Request too large");
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 20000) throw new Error("Request too large");
  }
  return JSON.parse(raw || "{}");
}
export default async function handler(req, res) {
  const respond = (status, value) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(value));
  };
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin;
  if (!originAllowed(origin))
    return respond(403, { error: "This origin is not allowed." });
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH, OPTIONS");
    return respond(405, { error: "Method not allowed." });
  }
  const url = new URL(req.url, "http://localhost"),
    action = url.searchParams.get("action");
  if ((req.method === "PATCH" || action) && !authorized(req))
    return respond(401, {
      error: "Enter a valid class access key. Your local draft is retained.",
    });
  if (action === "auth") return respond(200, { authorized: true });
  if (!process.env.DATABASE_URL)
    return respond(503, {
      error:
        "Shared saving is not configured. Keep your local draft or download a backup.",
    });
  const sql = neon(process.env.DATABASE_URL),
    exhibition = process.env.EXHIBITION_ID || "douglass-main";
  try {
    if (req.method === "GET" && action === "history") {
      const field = url.searchParams.get("field");
      if (!FIELD_BY_ID[field])
        return respond(400, { error: "Unknown exhibition field." });
      const before = Number(url.searchParams.get("before") || 2147483647);
      if (!Number.isSafeInteger(before) || before < 1)
        return respond(400, { error: "Invalid history cursor." });
      const rows =
        await sql`SELECT value,revision,changed_at AS "changedAt",writer FROM exhibition_history WHERE exhibition_id=${exhibition} AND field_id=${field} AND revision<${before} ORDER BY revision DESC LIMIT 101`;
      return respond(200, {
        history: rows.slice(0, 100),
        nextBefore: rows.length > 100 ? rows[99].revision : null,
      });
    }
    if (req.method === "GET") {
      if (action) return respond(400, { error: "Unknown action." });
      const rows =
        await sql`SELECT field_id,value,revision,updated_at AS "updatedAt",writer FROM exhibition_fields WHERE exhibition_id=${exhibition}`;
      const fields = {};
      let updatedAt = null;
      for (const { field_id, ...row } of rows) {
        if (!FIELD_BY_ID[field_id]) continue;
        fields[field_id] = row;
        if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
      }
      return respond(200, { fields, updatedAt });
    }
    let body;
    try {
      body = await bodyOf(req);
    } catch {
      return respond(400, { error: "Invalid or oversized request." });
    }
    const { field, value, expectedRevision, mutationId } = body || {};
    const def = typeof field === "string" ? FIELD_BY_ID[field] : undefined;
    if (
      !def ||
      typeof value !== "string" ||
      value.length > def.maxLength ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      expectedRevision > 2147483645 ||
      typeof mutationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        mutationId,
      ) ||
      (def.options && value && !def.options.some(([v]) => v === value))
    )
      return respond(400, {
        error: "A field value or revision was invalid. Your draft is retained.",
      });
    const writer =
      typeof body.writer === "string"
        ? body.writer.trim().slice(0, 80) || "Class contributor"
        : "Class contributor";
    const [row] =
      await sql`SELECT exhibition_save(${exhibition},${field},${value},${expectedRevision},${writer},${mutationId}::uuid) AS result`;
    if (row.result.invalidMutation)
      return respond(400, {
        error: "This save identifier was already used for another edit.",
      });
    if (!row.result.ok)
      return respond(409, {
        error: "Another classmate changed this field. Review both versions.",
        current: row.result.current,
      });
    return respond(200, { field: row.result.field });
  } catch (error) {
    console.error("Exhibition database request failed", {
      code: error.code || "unknown",
    });
    return respond(503, {
      error:
        "The shared database could not complete this request. Your local draft is retained; please retry.",
    });
  }
}
