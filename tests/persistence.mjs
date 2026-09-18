import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import http from "node:http";
import handler from "../api/exhibition.js";
import { CARDS, FIELD_BY_ID, progress } from "../src/exhibition-schema.js";
const sql = neon(process.env.DATABASE_URL),
  namespace = "qa-" + randomUUID();
process.env.EXHIBITION_ID = namespace;
const token = randomUUID();
process.env.EDITOR_SECRET_HASH = createHash("sha256")
  .update(token)
  .digest("hex");
async function request(
  method = "GET",
  body,
  query = "",
  auth = true,
  origin = "http://localhost:5173",
) {
  let data;
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(k, v) {
      headers[k] = v;
    },
    end(value) {
      data = value ? JSON.parse(value) : null;
    },
  };
  await handler(
    {
      method,
      url: "/api/exhibition" + query,
      body,
      headers: {
        origin,
        ...(auth ? { authorization: "Bearer " + token } : {}),
      },
    },
    res,
  );
  return { status: res.statusCode, body: data, headers };
}
const patch = (
  field,
  value,
  expectedRevision = 0,
  mutationId = randomUUID(),
) => ({
  field,
  value,
  expectedRevision,
  mutationId,
  writer: "Persistence test",
});
try {
  assert.equal(CARDS.length, 37);
  assert.ok(Object.keys(FIELD_BY_ID).length > 180);
  assert.ok(progress({}).every((r) => r.complete === 0));
  assert.equal((await request("GET", null, "", false)).status, 200);
  assert.equal(
    (await request("PATCH", patch("r1-symbol.title", "denied"), "", false))
      .status,
    401,
  );
  assert.equal(
    (await request("GET", null, "?action=history&field=r1-symbol.title", false))
      .status,
    401,
  );
  assert.equal((await request("PATCH", patch("bogus", "invalid"))).status, 400);
  assert.equal(
    (await request("PATCH", patch("r2-stage-1.freedom", "bogus"))).status,
    400,
  );
  assert.equal(
    (await request("GET", null, "", true, "https://evil.example")).status,
    403,
  );
  assert.equal(
    (await request("PATCH", patch("constructor", "invalid"))).status,
    400,
  );
  assert.equal(
    (await request("PATCH", patch(["r1-symbol.title"], "invalid"))).status,
    400,
  );
  const same = await Promise.all([
    request("PATCH", patch("r1-symbol.title", "First writer")),
    request("PATCH", patch("r1-symbol.title", "Second writer")),
  ]);
  assert.deepEqual(same.map((r) => r.status).sort(), [200, 409]);
  const winner = same.find((r) => r.status === 200).body.field;
  assert.equal(winner.revision, 1);
  const independent = await Promise.all([
    request("PATCH", patch("r1-symbol.context", "Context")),
    request("PATCH", patch("r1-symbol.meaning", "Meaning")),
  ]);
  assert.ok(independent.every((r) => r.status === 200));
  const retry = patch("r1-symbol.title", "Updated title", 1);
  assert.equal((await request("PATCH", retry)).body.field.revision, 2);
  assert.equal((await request("PATCH", retry)).body.field.revision, 2);
  assert.equal(
    (await request("PATCH", { ...retry, value: "Changed duplicate" })).status,
    400,
  );
  const history = await request(
    "GET",
    null,
    "?action=history&field=r1-symbol.title",
  );
  assert.deepEqual(
    history.body.history.map((r) => r.revision),
    [2, 1],
  );
  assert.equal(
    (await request("PATCH", patch("r1-symbol.title", winner.value, 2))).body
      .field.revision,
    3,
  );
  const reload = await request("GET", null, "", false);
  assert.equal(reload.body.fields["r1-symbol.title"].value, winner.value);
  assert.equal(reload.body.fields["r1-symbol.context"].value, "Context");
  console.log(
    "PASS: real database auth, input validation, CORS, independent edits, same-field conflicts, idempotent retries, reload and version restore.",
  );
  // Exercise browser draft and conflict logic against the real database handler.
  const storage = new Map();
  globalThis.location = { hostname: "localhost" };
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
  };
  globalThis.sessionStorage = {
    getItem: () => null,
    setItem() {},
    removeItem() {},
  };
  const { SharedExhibition } = await import("../src/shared-store.js");
  const client = () => {
    const s = new SharedExhibition({ editor: true });
    s.token = token;
    s.authorized = true;
    s.request = (q = "", o = {}) =>
      request(o.method || "GET", o.body ? JSON.parse(o.body) : null, q);
    return s;
  };
  const a = client(),
    b = client();
  await a.refresh();
  await b.refresh();
  a.edit("r1-symbol.title", "Client A");
  b.edit("r1-symbol.title", "Client B");
  await a.flush();
  await b.flush();
  assert.ok(b.pending["r1-symbol.title"].conflict);
  assert.equal(b.values()["r1-symbol.title"], "Client B");
  b.resolve("r1-symbol.title", "shared");
  assert.equal(b.values()["r1-symbol.title"], "Client A");
  a.online = false;
  a.edit("r1-symbol.meaning", "Offline draft retained");
  const restored = client();
  assert.equal(
    restored.values()["r1-symbol.meaning"],
    "Offline draft retained",
  );
  await restored.refresh();
  await restored.flush();
  await new Promise((r) => setTimeout(r, 800));
  assert.equal(
    (await request()).body.fields["r1-symbol.meaning"].value,
    "Offline draft retained",
  );
  // Lost acknowledgement: database committed, client saw a timeout; replay must not add a revision.
  const c = client();
  await c.refresh();
  const original = c.request.bind(c);
  let dropped = false;
  c.request = async (q, o) => {
    const result = await original(q, o);
    if (o?.method === "PATCH" && !dropped) {
      dropped = true;
      throw new Error("Simulated lost acknowledgement");
    }
    return result;
  };
  c.edit("r1-symbol.context", "Committed once");
  await c.flush();
  assert.ok(c.pending["r1-symbol.context"]);
  await c.refresh();
  assert.equal(c.pending["r1-symbol.context"], undefined);
  // A classmate changes a field while another user has it focused, before typing.
  const focused = client();
  await focused.refresh();
  const visibleRevision = focused.fields["r1-symbol.title"].revision;
  await request(
    "PATCH",
    patch("r1-symbol.title", "Other classmate", visibleRevision),
  );
  await focused.refresh();
  focused.edit("r1-symbol.title", "My stale focused edit", visibleRevision);
  assert.ok(focused.pending["r1-symbol.title"].conflict);
  focused.destroy();
  const saved = (
    await request("GET", null, "?action=history&field=r1-symbol.context")
  ).body.history;
  assert.equal(saved.filter((r) => r.value === "Committed once").length, 1);
  for (const s of [a, b, c, restored]) s.destroy();
  console.log(
    "PASS: two clients preserve conflicts, offline drafts survive reconstruction, retry after lost acknowledgement does not duplicate a save.",
  );
  // A real streaming HTTP connection receives committed edits without a reload.
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const abort = new AbortController(),
    timeout = setTimeout(() => abort.abort(), 10000);
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/api/exhibition`;
    const response = await fetch(endpoint + "?action=events", {
      signal: abort.signal,
    });
    assert.equal(response.status, 200);
    assert.ok(
      response.headers.get("content-type").includes("text/event-stream"),
    );
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    async function snapshot() {
      for (;;) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (data) return JSON.parse(data.slice(6));
        } else {
          const chunk = await reader.read();
          assert.ok(!chunk.done, "Live connection must deliver an event");
          buffer += decoder.decode(chunk.value, { stream: true });
        }
      }
    }
    const initial = await snapshot();
    assert.ok(initial.fields);
    const edit = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(
        patch("r1-control-4.title", "Live stream verification"),
      ),
    });
    assert.equal(edit.status, 200);
    let update;
    do {
      update = await snapshot();
    } while (!update.fields["r1-control-4.title"]);
    assert.equal(
      update.fields["r1-control-4.title"].value,
      "Live stream verification",
    );
    // Lower revisions arriving from a concurrent snapshot cannot roll back a newer save.
    const ordered = client();
    ordered.applySnapshot({
      fields: { "r1-control-4.title": { value: "New", revision: 8 } },
    });
    ordered.applySnapshot({
      fields: { "r1-control-4.title": { value: "Old", revision: 7 } },
    });
    assert.equal(ordered.values()["r1-control-4.title"], "New");
    ordered.destroy();
    await reader.cancel();
    console.log(
      "PASS: live HTTP event stream receives a committed save; older snapshots cannot overwrite newer revisions.",
    );
  } finally {
    clearTimeout(timeout);
    abort.abort();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await sql.transaction([
    sql`DELETE FROM exhibition_history WHERE exhibition_id=${namespace}`,
    sql`DELETE FROM exhibition_fields WHERE exhibition_id=${namespace}`,
  ]);
  console.log("Isolated test exhibition removed; classroom content untouched.");
}
