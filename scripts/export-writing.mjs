import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  writingSnapshot,
  buildWritingDocument,
} from "../src/document-export.js";
const requireDocx = createRequire(
  process.env.DOCX_RUNTIME_PACKAGES
    ? path.join(process.env.DOCX_RUNTIME_PACKAGES, "export-runtime.cjs")
    : import.meta.url,
);
const docx = requireDocx("docx");
const endpoint =
  process.env.EXHIBITION_EXPORT_URL ||
  "https://douglass-exhibition.vercel.app/api/exhibition";
let response;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15000),
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`Exhibition returned ${response.status}`);
    break;
  } catch (error) {
    if (attempt === 2) throw error;
  }
}
const state = await response.json();
if (!state.fields || typeof state.fields !== "object")
  throw new Error("The server did not return exhibition fields.");
const values = Object.fromEntries(
  Object.entries(state.fields).map(([id, row]) => [id, row.value]),
);
const snapshot = writingSnapshot(values);
if (!snapshot.fieldCount)
  throw new Error(
    "No written fields were returned. No empty backup was created.",
  );
const output = path.resolve(
  process.argv[2] ||
    `douglass-writing-${snapshot.exportedAt.replace(/[:.]/g, "-")}.docx`,
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  await docx.Packer.toBuffer(buildWritingDocument(snapshot, docx)),
);
if (process.env.EXHIBITION_EXPORT_SNAPSHOT)
  await writeFile(
    process.env.EXHIBITION_EXPORT_SNAPSHOT,
    JSON.stringify(snapshot, null, 2),
  );
console.log(
  JSON.stringify({
    output,
    fields: snapshot.fieldCount,
    entries: snapshot.entries.length,
    exportedAt: snapshot.exportedAt,
  }),
);
