import { FIELD_BY_ID } from "../src/exhibition-schema.js";
const listeners = new Map();
export async function readSnapshot(sql, exhibition) {
  const rows =
    await sql`SELECT f.field_id,f.value,f.revision,f.updated_at AS "updatedAt",f.writer,h.mutation_id AS "mutationId" FROM exhibition_fields f LEFT JOIN exhibition_history h ON h.exhibition_id=f.exhibition_id AND h.field_id=f.field_id AND h.revision=f.revision WHERE f.exhibition_id=${exhibition} ORDER BY f.field_id`;
  const fields = {};
  let updatedAt = null;
  for (const { field_id, ...row } of rows) {
    if (!FIELD_BY_ID[field_id]) continue;
    fields[field_id] = row;
    if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
  }
  return { fields, updatedAt };
}
export function publishSave(exhibition, field, row) {
  const update = { fields: { [field]: row }, updatedAt: row.updatedAt };
  for (const send of listeners.get(exhibition) || []) send(update);
}
export async function streamExhibition(res, sql, exhibition) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  let closed = false,
    wake,
    timer,
    lastSnapshot = "";
  const stop = () => {
    closed = true;
    clearTimeout(timer);
    wake?.();
  };
  res.on("close", stop);
  const send = (snapshot) => {
    if (!closed && !res.writableEnded)
      res.write(`event: exhibition\ndata: ${JSON.stringify(snapshot)}\n\n`);
  };
  if (!listeners.has(exhibition)) listeners.set(exhibition, new Set());
  listeners.get(exhibition).add(send);
  res.write("retry: 750\n: connected\n\n");
  const deadline = Date.now() + 45000;
  try {
    while (!closed && Date.now() < deadline) {
      const snapshot = await readSnapshot(sql, exhibition),
        signature = JSON.stringify(snapshot);
      if (signature !== lastSnapshot) {
        send(snapshot);
        lastSnapshot = signature;
      }
      if (closed) break;
      // The shared database also picks up saves handled by other function instances.
      await new Promise((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, 1000);
      });
    }
  } catch {
    if (!closed) res.write("event: unavailable\ndata: {}\n\n");
  } finally {
    stop();
    res.off("close", stop);
    const group = listeners.get(exhibition);
    group?.delete(send);
    if (!group?.size) listeners.delete(exhibition);
    if (!res.writableEnded) res.end();
  }
}
