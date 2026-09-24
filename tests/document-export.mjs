import assert from "node:assert/strict";
import * as docx from "docx";
import { unzipSync, strFromU8 } from "three/addons/libs/fflate.module.js";
import {
  writingSnapshot,
  buildWritingDocument,
} from "../src/document-export.js";
const values = {
  "r2-stage-1.visibility": "hidden",
  "r2-stage-1.happens": "Original answer preserved",
  "r2-stage-1.analysis": "A <B> & “C”\nSecond line",
  "r2-stage-1.image": "media:not-text",
  "r2-stage-1.imageCredit": "Photographer credit",
  "r1-control-1.quote": "An earlier room quotation",
  "r1-control-2.quote": "  ",
  "opening-slide.title": "Our presentation title",
};
const snapshot = writingSnapshot(values, {
  exportedAt: "2026-09-24T12:00:00.000Z",
  pending: { "r2-stage-1.analysis": {} },
  fields: { "r2-stage-1.analysis": { value: "Shared version also preserved" } },
});
assert.equal(snapshot.fieldCount, 5);
assert.equal(snapshot.draftCount, 1);
assert.deepEqual(
  snapshot.entries.map((e) => e.room),
  [0, 1, 2],
);
assert.equal(snapshot.entries[2].removed, true);
assert.ok(
  snapshot.entries[2].fields.some(
    (f) => f.value === "Original answer preserved",
  ),
);
const bytes = await docx.Packer.toBuffer(buildWritingDocument(snapshot, docx));
const files = unzipSync(bytes),
  xml = strFromU8(files["word/document.xml"]);
assert.ok(xml.includes("Original answer preserved"));
assert.ok(xml.includes("A &lt;B&gt; &amp; “C”"));
assert.ok(xml.includes("Shared version also preserved"));
assert.ok(xml.includes("Photographer credit"));
assert.ok(!xml.includes("media:not-text"));
assert.ok(
  !xml.includes("Are you ready?"),
  "Unwritten defaults are not class writing",
);
assert.ok(files["word/styles.xml"]);
assert.ok(files["[Content_Types].xml"]);
console.log(
  "PASS: Word export preserves authored text, chronological room order, removed entries, legacy answers, captions and both conflict versions; excludes image IDs and unwritten defaults.",
);
