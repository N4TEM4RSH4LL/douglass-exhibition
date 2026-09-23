import { QUESTION } from "./exhibition-schema.js";

// A tessellated sheet: every triangle belongs to the original flat title page.
// The shared edges prevent holes before the sheet breaks away.
export function fracturePieces(width, height) {
  const columns = width < 600 ? 3 : 5,
    rows = 3,
    points = [];
  for (let y = 0; y <= rows; y++) {
    points[y] = [];
    for (let x = 0; x <= columns; x++)
      points[y][x] = [
        ((x + (x && x < columns ? Math.sin(x * 6.7 + y * 2.3) * 0.19 : 0)) /
          columns) *
          width,
        ((y + (y && y < rows ? Math.cos(y * 5.1 + x * 3.7) * 0.19 : 0)) /
          rows) *
          height,
      ];
  }
  const pieces = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const a = points[y][x],
        b = points[y][x + 1],
        c = points[y + 1][x + 1],
        d = points[y + 1][x];
      pieces.push(
        ...((x + y) % 2
          ? [
              [a, b, d],
              [b, c, d],
            ]
          : [
              [a, b, c],
              [a, c, d],
            ]),
      );
    }
  return pieces.map((polygon, i) => {
    const cx = polygon.reduce((n, p) => n + p[0], 0) / 3,
      cy = polygon.reduce((n, p) => n + p[1], 0) / 3;
    return {
      polygon,
      cx,
      cy,
      x: (cx - width * 0.48) * 1.8,
      y: (cy - height * 0.48) * 1.5 + height * 0.22,
      angle: Math.sin(i * 8.1) * 33,
      delay: Math.hypot(cx / width - 0.48, cy / height - 0.48) * 170,
    };
  });
}

export function createOpening({
  reduced,
  onEnter,
  onReplay,
  directRoom = false,
}) {
  const root = document.querySelector("#opening-slide"),
    surface = root.querySelector(".opening-page");
  const begin = root.querySelector("#begin-exhibition"),
    skip = root.querySelector("#skip-opening");
  const status = root.querySelector("#opening-status");
  root.querySelector(".opening-question").textContent = QUESTION;
  let ready = false,
    busy = false,
    active = !directRoom;
  const museum = [
    "#topbar",
    "#corner-navigation",
    "#entry",
    "#navigation",
    "#modes",
    "#hotspots",
    "#world",
  ].map((s) => document.querySelector(s));
  function show(value) {
    active = value;
    root.hidden = !value;
    document.body.classList.toggle("opening-active", value);
    museum.forEach((el) => (el.inert = value));
    if (value) root.focus({ preventScroll: true });
  }
  function finish() {
    surface.hidden = false;
    root.querySelector(".opening-fractures")?.remove();
    busy = false;
    show(false);
    document
      .querySelector("#room-buttons button")
      ?.focus({ preventScroll: true });
  }
  async function enter({ shatter = true } = {}) {
    if (!ready || busy || !active) return;
    busy = true;
    begin.disabled = skip.disabled = true;
    status.textContent = "Entering the exhibition…";
    if (!shatter || reduced) {
      if (shatter)
        await surface.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 350,
          fill: "forwards",
        }).finished;
      surface.getAnimations().forEach((a) => a.cancel());
      onEnter();
      finish();
      return;
    }
    const width = root.clientWidth,
      height = root.clientHeight;
    const stage = document.createElement("div");
    stage.className = "opening-fractures";
    stage.setAttribute("aria-hidden", "true");
    stage.inert = true;
    const pieces = fracturePieces(width, height),
      animations = [];
    for (const piece of pieces) {
      const shard = document.createElement("div");
      shard.className = "opening-shard";
      shard.style.clipPath = `polygon(${piece.polygon.map((p) => p.map((v) => v + "px").join(" ")).join(",")})`;
      shard.style.transformOrigin = `${piece.cx}px ${piece.cy}px`;
      const copy = surface.cloneNode(true);
      copy.hidden = false;
      copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      copy.style.width = width + "px";
      copy.style.height = height + "px";
      shard.append(copy);
      stage.append(shard);
      animations.push({ shard, piece });
    }
    root.append(stage);
    surface.hidden = true;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.classList.add("opening-cracks");
    for (const piece of pieces) {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute(
        "d",
        `M${piece.polygon.map((p) => p.join(",")).join("L")}Z`,
      );
      svg.append(path);
    }
    stage.append(svg);
    svg.animate([{ opacity: 0 }, { opacity: 0.85 }, { opacity: 0 }], {
      duration: 700,
      fill: "forwards",
    });
    // Keep the authored entrance journey; only the title sheet moves away.
    onEnter();
    const flights = animations.map(
      ({ shard, piece }) =>
        shard.animate(
          [
            { transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1 },
            {
              transform: "translate3d(0,0,0) rotate(0deg)",
              opacity: 1,
              offset: 0.15,
            },
            {
              transform: `translate3d(${piece.x * 0.18}px,${piece.y * 0.08}px,90px) rotate(${piece.angle * 0.12}deg)`,
              opacity: 1,
              offset: 0.36,
            },
            {
              transform: `translate3d(${piece.x}px,${piece.y}px,620px) rotate(${piece.angle}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 1450,
            delay: piece.delay,
            easing: "cubic-bezier(.32,.02,.65,1)",
            fill: "forwards",
          },
        ).finished,
    );
    await Promise.allSettled(flights);
    finish();
  }
  begin.onclick = () => enter();
  skip.onclick = () => enter({ shatter: false });
  root.addEventListener("keydown", (e) => {
    if (
      (e.code === "Space" || e.code === "Enter") &&
      !e.repeat &&
      !e.target.closest("button,a")
    ) {
      e.preventDefault();
      enter();
    }
  });
  document.querySelector("#replay-opening").onclick = () => {
    if (busy) return;
    onReplay();
    surface.hidden = false;
    show(true);
    begin.disabled = skip.disabled = !ready;
    status.textContent = ready
      ? "Press Enter or begin when your class is ready."
      : "Preparing the museum…";
  };
  show(active);
  return {
    get active() {
      return active;
    },
    setReady() {
      ready = true;
      if (!busy) {
        begin.disabled = skip.disabled = false;
        status.textContent = "Press Enter or begin when your class is ready.";
      }
    },
  };
}
