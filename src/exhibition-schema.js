/** The assignment structure is shared by the editor, API validation and 3D displays. */
export const QUESTION =
  "How does Douglass move from having his life controlled by others to controlling his own story?";
export const ROOMS = [
  {
    id: 1,
    number: "I",
    title: "The man they tried to control",
    reading: "First half of Chapter 10",
    summary:
      "Build a control map around Douglass, then explain how his confrontation with Covey changes his sense of agency.",
    requirements: [
      "At least four forms of control, each supported by a Chapter 10 quotation and an explanation.",
      "An analysis of the confrontation with Covey as a turning point.",
      "A clear connection from control to resistance.",
    ],
  },
  {
    id: 2,
    number: "II",
    title: "The road to freedom",
    reading: "Second half of Chapter 10 and Chapter 11",
    summary:
      "Follow five significant events. Distinguish changes in physical freedom from changes in identity, confidence and self-respect.",
    requirements: [
      "Five events in a meaningful sequence.",
      "For each event: what happens, what changes and how Douglass presents the change.",
      "Label each stage external (E), internal (I), or both.",
      "An evidence-based answer about internal freedom before physical freedom.",
      "An explicit connection to resistance in Room I.",
    ],
  },
  {
    id: 3,
    number: "III",
    title: "Religion & hypocrisy",
    reading: "Chapters 9–10 and the Appendix",
    summary:
      "Place religious claims opposite the conduct Douglass describes, and analyse how the contradiction exposes slavery.",
    requirements: [
      "Three paired examples of a religious claim and contradictory conduct.",
      "Evidence and a named authorial method for each pair.",
      "A creative exhibit developed from one example.",
      "Approximately 150 words of synthesis explaining the effect of religious hypocrisy.",
    ],
  },
  {
    id: 4,
    number: "IV",
    title: "The identity archive",
    reading: "Chapter 11 and selected passages from the whole Narrative",
    summary:
      "Trace six stages: child, witness, learner, resister, freedom seeker and author. Show how both the person and his self-representation change.",
    requirements: [
      "Six stages, each with an event, quotation, authorial choice and explanation of change.",
      "An analysis of why withholding escape details can be an act of control.",
      "A concluding link from a controlled life to control of its representation.",
    ],
  },
  {
    id: 5,
    number: "V",
    title: "The man who took control of the story",
    reading: "The whole Narrative",
    summary:
      "Bring the rooms into one argument about agency and authorship. Use evidence to support the interpretation, rather than simply decorating the exhibition.",
    requirements: [
      "A 100-word curator’s statement answering the central question.",
      "At least eight significant quotations from across the Narrative, each interpreted.",
      "Clear connections between the rooms.",
      "At least one creative feature that advances the argument.",
    ],
  },
];
const f = (key, label, help, options = {}) => ({
  key,
  label,
  help,
  type: "textarea",
  required: true,
  maxLength: 4000,
  ...options,
});
const title = () =>
  f(
    "title",
    "Display title",
    "Give this display a short, specific title. It appears on its museum screen.",
    { type: "text", maxLength: 100 },
  );
const quote = () =>
  f(
    "quote",
    "Exact quotation",
    "Copy a short, exact quotation from your own edition of the Narrative. Keep Douglass’s wording and punctuation; do not invent or paraphrase inside quotation marks.",
    { maxLength: 1800 },
  );
const source = () =>
  f(
    "source",
    "Chapter and source reference",
    "Record the chapter (or Appendix), plus your edition and page number if available. Page numbers differ between editions.",
    { type: "text", maxLength: 240 },
  );
const method = () =>
  f(
    "method",
    "Authorial choice",
    "Name the method and explain a precise detail: for example contrast, imagery, irony, repetition, anecdote, tone, direct commentary or a decision about what to reveal.",
    { maxLength: 1800 },
  );
const meaning = () =>
  f(
    "meaning",
    "Why this object belongs here",
    "Explain what the displayed object symbolises, how it connects to Douglass’s experience, and how it supports this room’s argument. The models are symbolic; do not describe them as Douglass’s surviving possessions.",
    { maxLength: 2400 },
  );
const cards = [];
function add(id, room, label, guide, fields, options = {}) {
  cards.push({ id, room, label, guide, fields, ...options });
}
add(
  "r1-symbol",
  1,
  "The centre of the control map",
  "The chain display is the centre of the map. Establish who is being controlled and give the object an interpretive purpose.",
  [
    f(
      "title",
      "Central identity",
      "Name Frederick Douglass and give the central display a concise label.",
      { type: "text", maxLength: 100 },
    ),
    f(
      "context",
      "Starting position",
      "Explain Douglass’s situation under Covey at this point in Chapter 10. Establish the pressures surrounding him without retelling the entire chapter.",
    ),
    meaning(),
  ],
);
for (let i = 1; i <= 4; i++)
  add(
    `r1-control-${i}`,
    1,
    `Control ${i}`,
    "Each spoke should show a distinct form of control. Possible areas to investigate include fear, surveillance, exhaustion, punishment, religion, identity and lack of choice.",
    [
      f(
        "title",
        "Form of control",
        "Name one specific form of control. Avoid repeating another spoke.",
        { type: "text", maxLength: 100 },
      ),
      quote(),
      source(),
      f(
        "effect",
        "How it affects Douglass",
        "Explain how the evidence shows control over his actions, body, emotions, choices or identity. Analyse the quotation rather than merely restating it.",
      ),
      method(),
    ],
  );
add(
  "r1-turning-point",
  1,
  "The confrontation with Covey",
  "Explain why this confrontation is a turning point, including what changes internally even while slavery continues.",
  [
    title(),
    quote(),
    source(),
    f(
      "before",
      "Before the confrontation",
      "Describe Douglass’s condition and sense of agency before he resists.",
    ),
    f(
      "event",
      "The confrontation",
      "Summarise the crucial action. Keep the focus on its significance.",
    ),
    f(
      "after",
      "Why it is a turning point",
      "Explain the change in self-respect, determination or sense of control, and support your interpretation with the quotation.",
    ),
    method(),
  ],
);
add(
  "r1-resistance",
  1,
  "Control → resistance",
  "This connecting display carries the argument out of the first room.",
  [
    title(),
    f(
      "change",
      "What changes in Douglass?",
      "Compare his response to control before and after his resistance.",
    ),
    f(
      "connection",
      "Link to the road to freedom",
      "Explain how resistance creates greater agency and prepares the movement towards freedom in Room II.",
    ),
  ],
);
for (let i = 1; i <= 5; i++)
  add(
    `r2-stage-${i}`,
    2,
    `Journey stage ${i}`,
    "Arrange the five cases in chronological order. Each stage needs an event, a change and an explanation of the narrative choices that make the change significant.",
    [
      title(),
      f(
        "happens",
        "What happens?",
        "Identify the event and briefly explain its circumstances.",
      ),
      f(
        "changes",
        "What changes for Douglass?",
        "State the effect on his situation, independence, confidence, identity or self-respect.",
      ),
      method(),
      f(
        "freedom",
        "Kind of freedom",
        "E means external or physical freedom. I means internal freedom. Choose both only when your explanation supports both.",
        {
          type: "select",
          options: [
            ["E", "E — external / physical"],
            ["I", "I — internal"],
            ["E+I", "E + I — both"],
          ],
          maxLength: 3,
        },
      ),
      quote(),
      source(),
      meaning(),
    ],
  );
add(
  "r2-internal-freedom",
  2,
  "Internal freedom before physical freedom",
  "Answer the assignment’s question directly, allowing for complexity rather than treating freedom as a single moment.",
  [
    title(),
    f(
      "claim",
      "Your answer",
      "Was Douglass internally free before he was physically free? Give a clear, qualified interpretation.",
    ),
    quote(),
    source(),
    f(
      "analysis",
      "How the evidence supports your answer",
      "Explain the distinction between his external circumstances and his inner sense of identity or agency.",
    ),
  ],
);
add(
  "r2-connection",
  2,
  "Resistance → agency → freedom",
  "Connect this room to Room I rather than treating the journey as an unrelated timeline.",
  [
    title(),
    f(
      "connection",
      "Explain the connection",
      "Use an event from each room to show how resistance leads towards greater agency and freedom.",
    ),
  ],
);
for (let i = 1; i <= 3; i++)
  add(
    `r3-pair-${i}`,
    3,
    `Contradiction pair ${i}`,
    "One shared entry supplies two facing screens: a religious claim on one side, and the contradictory conduct on the other.",
    [
      title(),
      f(
        "claim",
        "What religion claims",
        "Identify the belief, moral claim or religious appearance that Douglass calls into question. Make clear when you are paraphrasing.",
      ),
      f(
        "action",
        "What slaveholders actually do",
        "Describe the conduct that contradicts that claim. Be specific about the example in the text.",
      ),
      quote(),
      source(),
      method(),
      f(
        "analysis",
        "What the contradiction exposes",
        "Explain how the contrast undermines the slaveholders’ moral authority and supports Douglass’s wider criticism of slavery.",
      ),
    ],
  );
add(
  "r3-contradiction",
  3,
  "Creative exhibit at the lectern",
  "Develop one of the three examples into a purposeful museum feature. The open book and chain provide a symbolic starting point; your explanation gives them meaning.",
  [
    title(),
    f(
      "example",
      "Chosen example",
      "Identify which contradiction pair you are developing.",
      {
        type: "select",
        options: [
          ["1", "Contradiction pair 1"],
          ["2", "Contradiction pair 2"],
          ["3", "Contradiction pair 3"],
        ],
        maxLength: 1,
      },
    ),
    f(
      "format",
      "Creative format",
      "Select how this feature should be read. This editor supports written display copy or an audio-guide script; it does not record audio.",
      {
        type: "select",
        options: [
          ["quotation", "Quotation display"],
          ["newspaper", "Newspaper-style exhibit"],
          ["artifact", "Symbolic artifact explanation"],
          ["script", "Audio-guide script"],
          ["digital", "Digital interpretation"],
        ],
        maxLength: 20,
      },
    ),
    f(
      "copy",
      "Exhibit text or script",
      "Write the actual creative feature. Ground it in the chosen example and do not invent historical quotations.",
    ),
    meaning(),
  ],
);
add(
  "r3-analysis",
  3,
  "Religion and hypocrisy — synthesis",
  "Write approximately 150 words answering how Douglass uses religious hypocrisy to expose contradictions within slavery.",
  [
    title(),
    f(
      "analysis",
      "150-word analysis",
      "Develop a connected argument using examples and authorial methods. Explain their effect, rather than listing techniques.",
      { targetWords: 150, wordRange: [130, 170], maxLength: 4500 },
    ),
  ],
);
const stages = [
  "Child",
  "Witness",
  "Learner",
  "Resister",
  "Freedom seeker",
  "Author",
];
for (let i = 1; i <= 6; i++)
  add(
    `r4-stage-${i}`,
    4,
    stages[i - 1],
    `This archive station represents Douglass as ${stages[i - 1].toLowerCase()}. Show the relationship between an experience, the way he narrates it, and his changing identity.`,
    [
      f(
        "title",
        "Stage subtitle",
        `Write a short subtitle for the ${stages[i - 1]} stage. The stage name is supplied automatically.`,
        { type: "text", maxLength: 100 },
      ),
      f(
        "event",
        "One important event",
        "Choose an event that makes this stage meaningful. Explain enough context for a visitor unfamiliar with the chapter.",
      ),
      quote(),
      source(),
      method(),
      f(
        "change",
        "How Douglass changes",
        "Explain the development in identity, knowledge, agency or self-representation. Connect it to the previous or next stage where useful.",
      ),
      meaning(),
    ],
  );
add(
  "r4-representation",
  4,
  "Control of the representation",
  "Bring the archive to its conclusion by examining Douglass’s choices as an author.",
  [
    title(),
    f(
      "withholding",
      "Withholding details of the escape",
      "Explain how choosing not to reveal every detail of his escape can itself be a form of control. Consider purpose, audience and the safety of others.",
    ),
    quote(),
    source(),
    f(
      "shift",
      "From a controlled life to control of the story",
      "Explain the shift from other people controlling his life to Douglass controlling how his life is represented.",
    ),
  ],
);
add(
  "r5-authors-desk",
  5,
  "The author’s desk",
  "Explain the significance of the pen, pages and book in the context of the whole exhibition.",
  [
    title(),
    meaning(),
    f(
      "connection",
      "How authorship answers the main question",
      "Explain what changes when Douglass can select, shape and publish his own account.",
    ),
  ],
);
add(
  "r5-curator-statement",
  5,
  "Curator’s statement",
  "Write 100 words answering the central question. Refer to the whole journey through Rooms I–IV and make one coherent argument.",
  [
    title(),
    f("statement", "100-word curator’s statement", QUESTION, {
      targetWords: 100,
      wordRange: [100, 100],
      maxLength: 3500,
    }),
  ],
);
for (let i = 1; i <= 8; i++)
  add(
    `r5-quotation-${i}`,
    5,
    `Evidence selection ${i}`,
    "Choose a significant quotation from across the Narrative. This wall is an evidence bank for the final argument, not a collection of decorative quotations.",
    [
      title(),
      quote(),
      source(),
      f(
        "interpretation",
        "What this quotation helps prove",
        "Analyse a detail of the wording or presentation and explain how it supports your interpretation of Douglass gaining control.",
      ),
      f(
        "connection",
        "Connection to the exhibition",
        "Name the relevant room or stage and explain how the evidence connects with the whole journey.",
      ),
    ],
  );
add(
  "r5-synthesis",
  5,
  "Connect the whole exhibition",
  "Check that the visitor can follow an argument from the opening control map to the final act of authorship.",
  [
    title(),
    f(
      "argument",
      "The argument across all five rooms",
      "Explain how each room leads into the next. Make the links explicit; do not give five disconnected summaries.",
    ),
    f(
      "creative",
      "How the creative feature supports the argument",
      "Identify at least one creative feature already completed in this exhibition and explain how its design helps communicate the interpretation.",
    ),
  ],
);
export const CARDS = cards;
export const CARD_BY_ID = Object.fromEntries(cards.map((c) => [c.id, c]));
export const FIELD_BY_ID = Object.fromEntries(
  cards.flatMap((c) =>
    c.fields.map((f) => [
      `${c.id}.${f.key}`,
      { ...f, card: c.id, room: c.room },
    ]),
  ),
);
Object.setPrototypeOf(CARD_BY_ID, null);
Object.setPrototypeOf(FIELD_BY_ID, null);
export function displayBinding(id) {
  let m = id.match(/^r3-(claim|action)-(\d)$/);
  if (m)
    return {
      card: `r3-pair-${m[2]}`,
      field: m[1],
      label:
        m[1] === "claim"
          ? "What religion claims"
          : "What slaveholders actually do",
    };
  m = id.match(/^r4-artifact-(\d)$/);
  if (m)
    return {
      card: `r4-stage-${m[1]}`,
      field: "meaning",
      label: stages[Number(m[1]) - 1],
    };
  return { card: id, field: null, label: CARD_BY_ID[id]?.label || id };
}
export const wordCount = (value) =>
  (value || "").trim().split(/\s+/).filter(Boolean).length;
export function cardProgress(card, values) {
  const required = card.fields.filter((f) => f.required);
  const completed = required.filter((f) =>
    (values[`${card.id}.${f.key}`] || "").trim(),
  ).length;
  const wordIssues = card.fields
    .filter((f) => f.wordRange && (values[`${card.id}.${f.key}`] || "").trim())
    .filter((f) => {
      const n = wordCount(values[`${card.id}.${f.key}`]);
      return n < f.wordRange[0] || n > f.wordRange[1];
    });
  return {
    completed,
    total: required.length,
    complete: completed === required.length && wordIssues.length === 0,
    wordIssues,
  };
}
export function progress(values) {
  return ROOMS.map((room) => {
    const cc = CARDS.filter((c) => c.room === room.id);
    const pp = cc.map((c) => cardProgress(c, values));
    return {
      room: room.id,
      complete: pp.filter((p) => p.complete).length,
      total: cc.length,
      fieldsDone: pp.reduce((a, p) => a + p.completed, 0),
      fieldsTotal: pp.reduce((a, p) => a + p.total, 0),
    };
  });
}
export function getDisplay(id, values) {
  const binding = displayBinding(id),
    card = CARD_BY_ID[binding.card];
  if (!card) return null;
  const v = Object.fromEntries(
    card.fields.map((f) => [f.key, values[`${card.id}.${f.key}`] || ""]),
  );
  const isStage = card.id.startsWith("r4-stage-");
  return {
    card,
    binding,
    title:
      (isStage
        ? card.label + " · "
        : binding.field === "claim"
          ? "Claim · "
          : binding.field === "action"
            ? "Conduct · "
            : "") + (v.title || binding.label),
    quote: v.quote,
    source: v.source,
    primary: binding.field
      ? v[binding.field]
      : v.effect ||
        v.happens ||
        v.analysis ||
        v.statement ||
        v.change ||
        v.meaning ||
        v.argument ||
        v.connection ||
        v.after ||
        v.context ||
        v.interpretation ||
        v.event ||
        v.copy ||
        "",
    method: v.method || "",
    values: v,
    hasContent: Object.values(v).some((s) => s.trim()),
  };
}
