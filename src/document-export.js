import {
  CARDS,
  OPENING_CARD,
  FIELD_BY_ID,
  ROOMS,
  isBoardVisible,
  visibleCardFields,
} from "./exhibition-schema.js";

// Snapshot every nonempty authored text field, including hidden boards and legacy answers.
export function writingSnapshot(
  values,
  {
    exportedAt = new Date().toISOString(),
    pending = {},
    fields = {},
    online = true,
  } = {},
) {
  const entries = [OPENING_CARD, ...CARDS]
    .map((card) => ({
      id: card.id,
      room: card.room,
      label: card.label,
      removed: card.room > 0 && !isBoardVisible(card.id, values),
      fields: [
        ...new Map(
          [...visibleCardFields(card), ...card.fields].map((f) => [f.key, f]),
        ).values(),
      ]
        .filter(
          (f) =>
            f.type !== "image" &&
            typeof values[`${card.id}.${f.key}`] === "string" &&
            values[`${card.id}.${f.key}`].trim(),
        )
        .map((f) => {
          const id = `${card.id}.${f.key}`;
          return {
            id,
            label: f.label,
            value: values[id],
            draft: !!pending[id],
            sharedValue:
              pending[id] &&
              fields[id]?.value &&
              fields[id].value !== values[id]
                ? fields[id].value
                : null,
          };
        }),
    }))
    .filter((entry) => entry.fields.length);
  const unknown = Object.entries(values).filter(
    ([id, value]) =>
      !FIELD_BY_ID[id] && typeof value === "string" && value.trim(),
  );
  if (unknown.length)
    entries.push({
      id: "additional",
      room: -1,
      label: "Additional saved writing",
      fields: unknown.map(([id, value]) => ({ id, label: id, value })),
    });
  return {
    exportedAt,
    online,
    entries,
    fieldCount: entries.reduce((n, e) => n + e.fields.length, 0),
    draftCount: entries.reduce(
      (n, e) => n + e.fields.filter((f) => f.draft).length,
      0,
    ),
  };
}

export function buildWritingDocument(snapshot, docx) {
  const { Document, Paragraph, TextRun, HeadingLevel, Footer, PageNumber } =
    docx;
  const heading = (text, level) =>
    new Paragraph({ text, heading: level, keepNext: true });
  const paragraph = (text, { italic = false, bold = false, ...options } = {}) =>
    new Paragraph({
      ...options,
      children: String(text)
        .split(/\r\n|\n|\r/)
        .map(
          (line, i) =>
            new TextRun({
              text: line,
              break: i ? 1 : 0,
              italics: italic,
              bold,
            }),
        ),
    });
  const cleanHeading = (text) =>
    text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const children = [
    heading("Douglass exhibition writing backup", HeadingLevel.TITLE),
    paragraph(
      `Exported ${new Date(snapshot.exportedAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC`,
    ),
    paragraph(
      `${snapshot.fieldCount} written fields arranged in exhibition order. Includes quotations, references, earlier responses and writing for removed boards. Image references remain in the JSON backup; this document preserves the text.`,
    ),
  ];
  if (!snapshot.online)
    children.push(
      paragraph(
        "This copy uses the latest exhibition data available on this device while offline.",
        { bold: true },
      ),
    );
  if (snapshot.draftCount)
    children.push(
      paragraph(
        `${snapshot.draftCount} fields include a local draft. Where a different shared version exists, both are included below.`,
        { bold: true },
      ),
    );
  let room = null;
  for (const entry of snapshot.entries) {
    if (room !== entry.room) {
      room = entry.room;
      children.push(
        heading(
          room === 0
            ? "Opening slides"
            : room === -1
              ? "Additional saved writing"
              : `Room ${ROOMS[room - 1].number}`,
          HeadingLevel.HEADING_1,
        ),
      );
      if (room > 0)
        children.push(
          paragraph(ROOMS[room - 1].title, { italic: true, keepNext: true }),
        );
    }
    if (entry.room !== 0)
      children.push(heading(cleanHeading(entry.label), HeadingLevel.HEADING_2));
    if (entry.removed)
      children.push(
        paragraph("Removed from the exhibition but preserved here", {
          italic: true,
          keepNext: true,
        }),
      );
    for (const field of entry.fields) {
      children.push(
        paragraph(field.label + (field.draft ? " — local draft" : ""), {
          bold: true,
          keepNext: true,
          spacing: { before: 140, after: 60 },
        }),
      );
      children.push(paragraph(field.value, { spacing: { after: 160 } }));
      if (field.sharedValue) {
        children.push(
          paragraph("Currently saved shared version", {
            italic: true,
            keepNext: true,
          }),
        );
        children.push(paragraph(field.sharedValue));
      }
    }
  }
  return new Document({
    creator: "The Douglass Exhibition",
    title: "Douglass exhibition writing backup",
    description: "A dated copy of the class exhibition writing",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "000000" },
          paragraph: { spacing: { after: 140, line: 276 }, widowControl: true },
        },
        title: {
          run: { font: "Arial", size: 42, bold: true, color: "000000" },
          paragraph: { spacing: { before: 0, after: 240 } },
        },
        heading1: {
          run: { font: "Arial", size: 32, bold: true, color: "000000" },
          paragraph: { spacing: { before: 320, after: 120 }, keepNext: true },
        },
        heading2: {
          run: { font: "Arial", size: 26, bold: true, color: "000000" },
          paragraph: { spacing: { before: 220, after: 120 }, keepNext: true },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: "right",
                children: [
                  new TextRun({ text: "Page ", size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}
export async function downloadWritingDocument(snapshot) {
  const docx = await import("docx");
  const blob = await docx.Packer.toBlob(buildWritingDocument(snapshot, docx));
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `douglass-writing-${snapshot.exportedAt.replace(/[:.]/g, "-")}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
