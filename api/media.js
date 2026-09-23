import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { authorized, originAllowed, bodyOf } from "./exhibition.js";

export function decodeImage(value) {
  if (typeof value !== "string" || value.length > 1400000)
    throw Error("Choose an image under 1 MB after resizing.");
  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+=*)$/,
  );
  if (!match) throw Error("Upload a JPEG, PNG or WebP image.");
  const bytes = Buffer.from(match[2], "base64"),
    mime = match[1];
  if (!bytes.length || bytes.length > 1000000)
    throw Error("The image is too large.");
  const valid =
    mime === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw Error("The file does not match a supported image format.");
  return { bytes, mime, id: createHash("sha256").update(bytes).digest("hex") };
}
export default async function media(req, res) {
  const json = (status, value) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  if (!originAllowed(req.headers.origin))
    return json(403, { error: "This origin is not allowed." });
  if (req.headers.origin)
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (!["GET", "POST"].includes(req.method))
    return json(405, { error: "Method not allowed." });
  if (req.method === "POST" && !authorized(req))
    return json(401, {
      error: "Unlock shared editing before uploading an image.",
    });
  if (!process.env.DATABASE_URL)
    return json(503, { error: "Shared image storage is unavailable." });
  const sql = neon(process.env.DATABASE_URL),
    exhibition = process.env.EXHIBITION_ID || "douglass-main";
  try {
    if (req.method === "GET") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      if (!/^[a-f0-9]{64}$/.test(id || ""))
        return json(400, { error: "Invalid image identifier." });
      const [row] =
        await sql`SELECT mime,encode(data,'base64') AS data FROM exhibition_media WHERE exhibition_id=${exhibition} AND id=${id}`;
      if (!row) return json(404, { error: "Image not found." });
      res.setHeader("Content-Type", row.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(Buffer.from(row.data, "base64"));
    }
    let image;
    try {
      image = decodeImage((await bodyOf(req, 1500000)).image);
    } catch (e) {
      return json(400, { error: e.message });
    }
    await sql`INSERT INTO exhibition_media(exhibition_id,id,mime,data) VALUES(${exhibition},${image.id},${image.mime},decode(${image.bytes.toString("hex")},'hex')) ON CONFLICT DO NOTHING`;
    return json(200, { reference: "media:" + image.id });
  } catch {
    return json(503, {
      error:
        "The image could not be saved. Your existing image and writing are unchanged; retry the upload.",
    });
  }
}
