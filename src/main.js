import "./style.css";
import "./opening-slide.css";
import "./room-composition.css";
import "./presentation.css";
import { graphicsProfile, savedGraphics } from "./graphics-settings.js";
import { previewMessage } from "./developer-preview.js";
import {
  presentationEntries,
  presentationEntryHTML,
  FEATURE_ANCHORS,
  featureIcon,
} from "./presentation-content.js";
import { compositionHTML } from "./room-composition.js";
import { createOpening } from "./opening-slide.js";
import { pickBoard } from "./board-interaction.js";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import {
  shoreline,
  isLand,
  segmentClear,
  pointClear,
  moveWithCollisions,
} from "./navigation.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createWorld } from "./world.js";
import { createCameraJourney, advanceCameraJourney } from "./camera-journey.js";
import { views, roomJourney } from "./museum-views.js";
import { connectExhibition } from "./exhibition-content.js";
import {
  ROOMS,
  isBoardVisible,
  displayBinding,
  CARD_BY_ID,
} from "./exhibition-schema.js";

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const icons = {
  home: '<path d="M3 10 12 3l9 7M6 9v12h12V9M10 21v-8h4v8M2 23h20"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4ZM15 9q4 3 0 6M18 6q7 6 0 12"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4ZM16 9l6 6m0-6-6 6"/>',
  quality:
    '<path d="m12 3 9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v8M7 5.8 17 11"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  previous: '<path d="m14 6-6 6 6 6"/>',
  next: '<path d="m10 6 6 6-6 6"/>',
  tour: '<path d="m8 4 12 8-12 8Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m11 8 4 1 3 5M11 8l-3 5-4 1m8-5-1 7-4 6m4-6 5 2 2 4"/>',
  overview: '<path d="m12 3 10 6-10 6L2 9ZM3 13l9 6 9-6M3 17l9 6 9-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  door: '<path d="M4 21V3h13v18M8 21V7l7-2v16M11 13v2M2 21h20"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
};
const svg = (k) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[k]}</svg>`;
for (const k of [
  "home",
  "quality",
  "fullscreen",
  "previous",
  "next",
  "tour",
  "walk",
  "overview",
])
  $("#" + k).innerHTML = svg(k);
$("#sound").innerHTML = svg("mute");
$("#close-artifact").innerHTML = svg("close");
$(".entry-icon").innerHTML = svg("door");
$(".entry-arrow").innerHTML = svg("arrow");
const roman = ["", "I", "II", "III", "IV", "V"];
for (let i = 1; i <= 5; i++) {
  const b = document.createElement("button");
  b.textContent = roman[i];
  b.dataset.room = i;
  b.setAttribute("aria-label", `Enter exhibition room ${i}`);
  b.title = `Room ${roman[i]}`;
  $("#room-buttons").append(b);
}
const previewMode =
  new URLSearchParams(location.search).get("preview") === "board" &&
  window.parent !== window;
if (previewMode) document.body.classList.add("board-preview-mode");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const initialRoom = Number(
  new URLSearchParams(location.hash.slice(1)).get("room"),
);
let presentationMode =
  new URLSearchParams(location.search).get("mode") === "presentation";
let presentationEntry = null;
let lastCompositionValues = "";
const opening = createOpening({
  reduced,
  directRoom: initialRoom >= 1 && initialRoom <= 5,
  onEnter: ({ mode }) => {
    setPresentationMode(mode === "presentation");
    navigate(1);
  },
  onReplay: () => {
    stopTour();
    closeArtifact();
    navigate(0);
  },
});
const touch = matchMedia("(pointer: coarse)").matches;
let graphicsChoice = previewMode
  ? new URLSearchParams(location.search).get("quality") || "high"
  : savedGraphics();
let graphicsDegraded = false;
let profile = graphicsProfile(graphicsChoice, { touch });
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (error) {
  $("#loading").remove();
  $("#error").hidden = false;
  throw error;
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(profile.ratio);
renderer.shadowMap.enabled = !!profile.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$("#world").append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#77a6bd");
scene.fog = new THREE.FogExp2("#9eb5b7", 0.0019);
const camera = new THREE.PerspectiveCamera(
  innerWidth < 700 ? 65 : 51,
  innerWidth / innerHeight,
  0.08,
  420,
);
camera.position.set(26, 12, 47);
const target = new THREE.Vector3(0, 2, -2);
camera.lookAt(target);
// A photographed cloud panorama gives the sky detail in every direction.
new HDRLoader().load(
  import.meta.env.BASE_URL + "textures/sky.hdr",
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.backgroundIntensity = 0.48;
    scene.backgroundRotation.y = 0.8;
    const generator = new THREE.PMREMGenerator(renderer);
    scene.environment = generator.fromEquirectangular(texture).texture;
    scene.environmentRotation.y = 0.8;
    scene.environmentIntensity = 0.4;
    generator.dispose();
    renderer.shadowMap.needsUpdate = true;
  },
  undefined,
  () => {
    scene.background = new THREE.Color("#679ebd");
  },
);
const hemi = new THREE.HemisphereLight("#c3dacd", "#5c5037", 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffdfaa", 2.8);
sun.position.set(-36, 27, 19);
sun.target.position.set(0, 0, -4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -44;
sun.shadow.camera.right = 44;
sun.shadow.camera.top = 44;
sun.shadow.camera.bottom = -44;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const ambient = new THREE.AmbientLight("#b9cfc1", 0.3);
scene.add(ambient);
const world = createWorld(scene);
const exhibition = connectExhibition(world);
exhibition.store.subscribe(() => opening.update(exhibition.values()));
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.19,
  0.65,
  2.2,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let room = 0,
  walking = false,
  overview = false,
  touring = false,
  tourTime = 0,
  transition = null,
  time = 0,
  idleTime = 0,
  drag = null,
  dragged = false,
  orbitYaw = 0,
  orbitPitch = 0,
  focus = null;
let interior = false,
  insideLight = 0,
  frameTimes = [],
  lastPerformance = performance.now(),
  lastRender = 0;
const vec = (a) => new THREE.Vector3(...a);
const yawPitch = new THREE.Euler(0, 0, 0, "YXZ");
function setCamera(pos, look) {
  camera.position.copy(pos);
  camera.lookAt(look);
  target.copy(look);
}
function fly(points, duration = 3.5, onDone = null) {
  const journey = createCameraJourney(
    camera.position,
    camera.quaternion,
    points,
    world.colliders,
    { duration, reduced },
  );
  if (!journey) return false;
  transition = journey;
  transition.onDone = onDone;
  orbitYaw = orbitPitch = idleTime = 0;
  $("#camera-fade").style.transition = "none";
  $("#camera-fade").style.opacity = "0";
  return true;
}
function stopTour() {
  touring = false;
  $("#tour").setAttribute("aria-pressed", "false");
  $("#tour").setAttribute("aria-label", "Start guided tour");
  $("#tour").innerHTML = svg("tour");
}
function closeArtifact() {
  document.body.classList.remove("artifact-focused");
  if ($("#artifact-panel").open) $("#artifact-panel").close();
  if (focus) {
    focus = null;
    fly([views[room]], 1.2);
    updatePresentationControls();
  }
}
function updateUI() {
  document.body.classList.remove("artifact-focused");
  $("#entry").hidden = room !== 0 || overview;
  $("#arrival span").textContent = roman[room] || "";
  $("#read-room").hidden = room === 0 || overview;
  $("#feature-room").hidden = room === 0 || overview;
  $("#feature-room").textContent = room ? ROOMS[room - 1].feature + " ↗" : "";
  $("#read-room").textContent = room ? `Read Room ${roman[room]} ↗` : "";
  $$("#room-buttons button").forEach((b) => {
    const active = Number(b.dataset.room) === room;
    b.classList.toggle("active", active);
    b.setAttribute("aria-current", active ? "step" : "false");
  });
  $$("#plan rect").forEach((r) =>
    r.classList.toggle("active", Number(r.dataset.room) === room),
  );
  document.body.classList.toggle("walking", walking);
  $("#walk").setAttribute("aria-pressed", String(walking));
  $("#overview").setAttribute("aria-pressed", String(overview));
  $("#artifact-panel").open && $("#artifact-panel").close();
  focus = null;
  updatePresentationControls();
}
function navigate(next, { auto = false } = {}) {
  const destination = Math.min(5, Math.max(0, next));
  if (destination === room && !walking && !overview && !transition && !focus)
    return;
  if (!auto) stopTour();
  if (document.pointerLockElement) document.exitPointerLock();
  const points = roomJourney(camera.position, destination);
  if (!fly(points, destination === 0 ? 4.5 : room === 0 ? 6 : 3.2)) return;
  walking = false;
  overview = false;
  room = destination;
  tourTime = 0;
  world.roof.visible = true;
  renderer.shadowMap.needsUpdate = true;
  updateUI();
  history.replaceState(
    null,
    "",
    location.pathname + location.search + (room ? `#room=${room}` : ""),
  );
}
function openArtifact(h) {
  if (
    transition ||
    walking ||
    overview ||
    !isBoardVisible(h.id, exhibition.values())
  )
    return;
  stopTour();
  focus = h;
  document.body.classList.add("artifact-focused");
  const outward = camera.position.clone().sub(h.position);
  outward.y = 0;
  outward.normalize();
  const pos = h.position
    .clone()
    .addScaledVector(outward, h.type === "analysis" ? 2.7 : 2.6);
  pos.y = Math.max(1.95, h.position.y + 0.3);
  const look = h.position.clone();
  look.x += 0.45;
  if (
    !pointClear(pos.x, pos.z, world.colliders) ||
    !segmentClear(
      [camera.position.x, camera.position.z],
      [pos.x, pos.z],
      world.colliders,
    )
  )
    pos.copy(camera.position);
  fly([{ p: pos.toArray(), t: look.toArray() }], 1.3);
  exhibition.show(h.id);
  $("#artifact-panel").show();
}
const hotspotElements = world.hotspots.map((h) => {
  const b = document.createElement("button");
  b.className = "hotspot";
  b.hidden = true;
  b.dataset.slot = h.id;
  b.setAttribute("aria-label", `Inspect ${exhibition.title(h.id)}`);
  b.title = exhibition.title(h.id);
  b.addEventListener("click", () => openArtifact(h));
  $("#hotspots").append(b);
  return { h, b };
});
const roomFeatureElements = FEATURE_ANCHORS.map((anchor) => {
  const b = document.createElement("button"),
    r = ROOMS[anchor.room - 1];
  b.className = "room-feature-hotspot";
  b.hidden = true;
  b.dataset.featureRoom = anchor.room;
  b.setAttribute("aria-label", `Open ${r.feature} in Room ${r.number}`);
  b.innerHTML = featureIcon(anchor.room) + `<span>${r.feature}</span>`;
  b.onclick = () => openRoomFeature();
  $("#room-features").append(b);
  return { ...anchor, position: new THREE.Vector3(...anchor.position), b };
});
exhibition.store.subscribe(() => {
  renderer.shadowMap.needsUpdate = true;
  if (focus?.id && !isBoardVisible(focus.id, exhibition.values()))
    closeArtifact();
  for (const button of $$("[data-reader-entry]")) {
    if (!isBoardVisible(button.dataset.readerEntry, exhibition.values()))
      button.remove();
  }
  for (const { h, b } of hotspotElements) {
    if (!isBoardVisible(h.id, exhibition.values())) b.hidden = true;
    b.title = exhibition.title(h.id);
    b.setAttribute("aria-label", `Inspect ${exhibition.title(h.id)}`);
  }
});
$("#enter").onclick = () => navigate(1);
$("#home").onclick = () => navigate(0);
$("#next").onclick = () => navigate(room === 5 ? 0 : room + 1);
$("#previous").onclick = () => navigate(Math.max(0, room - 1));
$$("#room-buttons button").forEach(
  (b) => (b.onclick = () => navigate(Number(b.dataset.room))),
);
$$("#plan rect").forEach(
  (b) => (b.onclick = () => navigate(Number(b.dataset.room))),
);
$("#close-artifact").onclick = closeArtifact;
$("#tour").onclick = () => {
  if (touring) {
    stopTour();
    return;
  }
  touring = true;
  tourTime = 0;
  $("#tour").setAttribute("aria-pressed", "true");
  $("#tour").setAttribute("aria-label", "Pause guided tour");
  $("#tour").innerHTML = svg("pause");
  if (room === 0 || room === 5) navigate(1, { auto: true });
};
$("#overview").onclick = () => {
  stopTour();
  if (document.pointerLockElement) document.exitPointerLock();
  const next = !overview,
    points = [];
  if (next) {
    if (camera.position.y < 4.2)
      points.push({ p: [0, 2.15, 24], t: [0, 2, 35] });
    points.push(views.overview);
  } else {
    if (room > 0 && camera.position.y >= 4.2)
      points.push({ p: [0, 2.4, 24], t: [0, 2.2, 9] });
    points.push(views[room]);
  }
  if (
    !fly(points, 6, () => {
      world.roof.visible = !overview;
      renderer.shadowMap.needsUpdate = true;
    })
  )
    return;
  walking = false;
  overview = next;
  world.roof.visible = true;
  renderer.shadowMap.needsUpdate = true;
  updateUI();
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
};
function quality() {
  profile = graphicsProfile(graphicsChoice, {
    touch,
    degraded: graphicsDegraded,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  renderer.setPixelRatio(profile.ratio);
  composer.setPixelRatio(profile.ratio);
  bloom.enabled = profile.bloom;
  renderer.shadowMap.enabled = !!profile.shadows;
  sun.shadow.mapSize.set(profile.shadows || 512, profile.shadows || 512);
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  renderer.shadowMap.needsUpdate = true;
  world.dust.visible = profile.dust;
  scene.traverse((object) => {
    for (const material of Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : []) {
      for (const key of ["map", "normalMap", "roughnessMap", "bumpMap"]) {
        if (material[key]?.isTexture) {
          material[key].anisotropy = profile.anisotropy;
          if (material[key].image?.width) material[key].needsUpdate = true;
        }
      }
    }
  });
  exhibition.setResolution(profile.boards, profile.anisotropy);
  $("#graphics-preset").value = graphicsChoice;
  $("#graphics-description").textContent =
    (graphicsChoice === "auto"
      ? `Automatic is using ${profile.label}. It can lower detail if the frame rate stays low. `
      : "") + profile.description;
  $("#graphics-detail").textContent =
    `${profile.ratio}× resolution · ${profile.shadows ? profile.shadows + " px shadows" : "Shadows off"} · ${profile.boards} px boards · ${profile.fps ? profile.fps + " FPS limit" : "Uncapped"}`;
  $("#world").dataset.quality = profile.id;
}
function showGraphics() {
  if (document.pointerLockElement) document.exitPointerLock();
  keys.clear();
  $("#graphics-dialog").showModal();
}
$("#quality").onclick = showGraphics;
$("#presentation-graphics").onclick = showGraphics;
$("#opening-graphics").onclick = showGraphics;
$("#close-graphics").onclick = $("#apply-graphics").onclick = () =>
  $("#graphics-dialog").close();
$("#graphics-preset").onchange = () => {
  graphicsChoice = $("#graphics-preset").value;
  graphicsDegraded = false;
  frameTimes = [];
  try {
    localStorage.setItem("douglass-graphics-v1", graphicsChoice);
  } catch {}
  quality();
};
quality();
function walk() {
  if (transition) return;
  if (walking) {
    keys.clear();
    navigate(room);
    return;
  }
  stopTour();
  closeArtifact();
  overview = false;
  world.roof.visible = true;
  renderer.shadowMap.needsUpdate = true;
  walking = !walking;
  transition = null;
  $("#camera-fade").style.opacity = "0";
  if (walking) {
    if (room === 0) setCamera(vec([0, 2.1, 22]), vec([0, 2.1, 12]));
    else camera.position.y = 2.08;
    target
      .copy(camera.position)
      .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3));
    yawPitch.setFromQuaternion(camera.quaternion);
    if (!touch) {
      renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
    }
  } else if (document.pointerLockElement) document.exitPointerLock();
  updateUI();
}
$("#walk").onclick = walk;
$("#walk-page").onclick = walk;
$("#presentation-walk").onclick = walk;
const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (opening.active || previewMode || $("#graphics-dialog").open) return;
  if (presentationMode && !e.target.closest("input,textarea,select")) {
    if (walking) {
      if (e.code === "Escape") {
        keys.clear();
        navigate(room);
      } else if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "ShiftLeft",
        ].includes(e.code)
      ) {
        e.preventDefault();
        keys.add(e.code);
      } else if (e.code === "KeyF" && !e.repeat) $("#fullscreen").click();
      return;
    }
    if ($("#artifact-panel").open) {
      if (e.code === "Escape") closeArtifact();
      return;
    }
    if (
      ["ArrowRight", "PageDown", "Space", "ArrowLeft", "PageUp"].includes(
        e.code,
      )
    ) {
      if (e.code === "Space" && e.target.closest("button,a")) return;
      e.preventDefault();
      if (!e.repeat)
        stepPresentation(["ArrowLeft", "PageUp"].includes(e.code) ? -1 : 1);
    } else if (e.code === "KeyF" && !e.repeat) $("#fullscreen").click();
    return;
  }
  if ($("#room-reader").open) return;
  if (e.target.closest("input,textarea,select")) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys.add(e.code);
  if (e.code === "Escape") {
    if (focus) closeArtifact();
    if (walking) {
      keys.clear();
      navigate(room);
    }
    if (document.body.classList.contains("ui-hidden"))
      document.body.classList.remove("ui-hidden");
  }
  if (e.code === "KeyH" && !e.repeat)
    document.body.classList.toggle("ui-hidden");
  if (e.code === "KeyF" && !e.repeat) $("#fullscreen").click();
  if (e.code === "Space" && !e.repeat) $("#tour").click();
  if (/Digit[1-5]/.test(e.code)) navigate(Number(e.code.slice(-1)));
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (transition) return;
  drag = { x: e.clientX, y: e.clientY };
  dragged = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});
function lookMove(dx, dy) {
  if (walking) {
    yawPitch.y -= dx * 0.0028;
    yawPitch.x = THREE.MathUtils.clamp(yawPitch.x - dy * 0.0028, -1.25, 1.25);
    camera.quaternion.setFromEuler(yawPitch);
    target
      .copy(camera.position)
      .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
  } else {
    orbitYaw -= dx * 0.003;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.003, -0.45, 0.65);
  }
}
window.addEventListener("pointermove", (e) => {
  if (transition) return;
  if (document.pointerLockElement === renderer.domElement) {
    lookMove(e.movementX, e.movementY);
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
  lookMove(dx, dy);
  drag = { x: e.clientX, y: e.clientY };
});
window.addEventListener("pointerup", () => (drag = null));
window.addEventListener("pointercancel", () => (drag = null));
const boardRaycaster = new THREE.Raycaster();
renderer.domElement.addEventListener("click", (e) => {
  if (dragged || transition || walking || overview || focus || opening.active)
    return;
  const bounds = renderer.domElement.getBoundingClientRect();
  boardRaycaster.setFromCamera(
    new THREE.Vector2(
      ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
      1 - ((e.clientY - bounds.top) / bounds.height) * 2,
    ),
    camera,
  );
  const id = pickBoard(boardRaycaster, scene, room);
  const hotspot = world.hotspots.find((h) => h.id === id && h.room === room);
  if (hotspot) openArtifact(hotspot);
});
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (walking || transition) return;
    camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.018, 33, 70);
    camera.updateProjectionMatrix();
  },
  { passive: false },
);
const joy = { x: 0, y: 0 };
let joyActive = false;
const joystick = $("#joystick"),
  knob = $("#joystick div");
function updateJoy(e) {
  const r = joystick.getBoundingClientRect();
  let x = (e.clientX - r.x - r.width / 2) / 35,
    y = (e.clientY - r.y - r.height / 2) / 35;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  joy.x = x;
  joy.y = y;
  knob.style.transform = `translate(${x * 30}px,${y * 30}px)`;
}
joystick.addEventListener("pointerdown", (e) => {
  joyActive = true;
  joystick.setPointerCapture(e.pointerId);
  updateJoy(e);
});
joystick.addEventListener("pointermove", (e) => {
  if (joyActive) updateJoy(e);
});
for (const event of ["pointerup", "pointercancel"])
  joystick.addEventListener(event, () => {
    joyActive = false;
    joy.x = joy.y = 0;
    knob.style.transform = "";
  });
function onWalkableGround(x, z) {
  return (
    Math.abs(x) < 105 &&
    z < 108 &&
    (z >= shoreline(x) + 0.65 ||
      (Math.abs(x + 6) < 1.08 && z >= shoreline(-6) - 17.3))
  );
}
function canMove(x, z) {
  return onWalkableGround(x, z) && pointClear(x, z, world.colliders);
}
// Opt-in procedural ambience, with no network audio, voices or autoplay.
let audioCtx,
  audioGain,
  soundOn = false;
async function toggleSound() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0;
    audioGain.connect(audioCtx.destination);
    const length = audioCtx.sampleRate * 5;
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.025) / 1.025;
      data[i] = last * 3;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 630;
    source.connect(filter);
    filter.connect(audioGain);
    source.start();
    for (const freq of [123.47, 185, 246.94]) {
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      gain.gain.value = 0.008;
      oscillator.connect(gain);
      gain.connect(audioGain);
      oscillator.start();
    }
  }
  await audioCtx.resume();
  soundOn = !soundOn;
  audioGain.gain.setTargetAtTime(soundOn ? 0.3 : 0, audioCtx.currentTime, 1);
  $("#sound").setAttribute("aria-pressed", String(soundOn));
  $("#sound").setAttribute(
    "aria-label",
    soundOn ? "Mute ambient sound" : "Enable ambient sound",
  );
  $("#sound").innerHTML = svg(soundOn ? "sound" : "mute");
}
$("#sound").onclick = () => toggleSound().catch(() => {});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    audioCtx?.suspend();
  } else if (soundOn) audioCtx?.resume();
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < 700 ? 65 : 51;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
renderer.domElement.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  $("#error").hidden = false;
});
const clock = new THREE.Timer();
let frames = 0;
function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) {
    clock.update();
    return;
  }
  const now = performance.now();
  if (profile.fps && now - lastRender < 1000 / profile.fps - 1) return;
  lastRender = now;
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.055);
  time += dt;
  frames++;
  if (transition) {
    const tr = advanceCameraJourney(transition, dt);
    camera.position.copy(tr.position);
    camera.quaternion.copy(tr.rotation);
    target
      .copy(camera.position)
      .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
    $("#camera-fade").style.opacity = String(tr.fade);
    if (tr.done) {
      transition = null;
      idleTime = 0;
      tr.onDone?.();
      updatePresentationControls();
    }
  } else if (walking) {
    const speed = (keys.has("ShiftLeft") ? 5.5 : 3.2) * dt;
    const f =
      Number(keys.has("KeyW") || keys.has("ArrowUp")) -
      Number(keys.has("KeyS") || keys.has("ArrowDown")) -
      joy.y;
    const s =
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft")) +
      joy.x;
    const dir = new THREE.Vector3(
      -Math.sin(yawPitch.y),
      0,
      -Math.cos(yawPitch.y),
    );
    const right = new THREE.Vector3(
      Math.cos(yawPitch.y),
      0,
      -Math.sin(yawPitch.y),
    );
    const delta = dir.multiplyScalar(f).addScaledVector(right, s);
    if (delta.lengthSq() > 1) delta.normalize();
    delta.multiplyScalar(speed);
    const next = moveWithCollisions(
      [camera.position.x, camera.position.z],
      [delta.x, delta.z],
      world.colliders,
      onWalkableGround,
    );
    camera.position.x = next[0];
    camera.position.z = next[1];
    camera.position.y =
      ((camera.position.z < 17.4 &&
        camera.position.z > -21.4 &&
        Math.abs(camera.position.x) < 11.5) ||
      (Math.abs(camera.position.x + 6) < 1.35 &&
        camera.position.z < shoreline(-6) + 2 &&
        camera.position.z > shoreline(-6) - 18)
        ? 2.08
        : 1.68) +
      (!reduced && delta.lengthSq() > 0 ? Math.sin(time * 9) * 0.018 : 0);
    target
      .copy(camera.position)
      .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3));
    const x = camera.position.x,
      z = camera.position.z;
    let rr = room;
    if (z > 14 || Math.abs(x) > 11.3 || z < -21) rr = 0;
    else if (z < -11) rr = 5;
    else if (x < -2) rr = z > 1 ? 1 : 4;
    else if (x > 2) rr = z > 1 ? 2 : 3;
    if (rr !== room) {
      room = rr;
      updateUI();
    }
  } else if (!focus && !previewMode) {
    idleTime += dt;
    const v = overview ? views.overview : views[room];
    const base = vec(v.p),
      look = vec(v.t);
    let offset = base.sub(look);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta +=
      orbitYaw +
      (!reduced && room === 0 && !overview
        ? Math.sin(idleTime * 0.065) * 0.09
        : 0);
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + orbitPitch,
      0.2,
      1.85,
    );
    offset.setFromSpherical(spherical);
    if (room > 0 && !overview) {
      const p = vec(v.p);
      const direction = vec(v.t).sub(p);
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitYaw);
      direction.y += orbitPitch * 4;
      setCamera(p, p.clone().add(direction));
    } else setCamera(look.clone().add(offset), look);
    if (touring) {
      tourTime += dt;
      if (!reduced) orbitYaw = Math.sin(tourTime * 0.13) * 0.11;
      if (tourTime > 13) {
        tourTime = 0;
        if (room === 5) {
          stopTour();
        } else navigate(room + 1, { auto: true });
      }
    }
  }
  interior =
    camera.position.z < 13.5 &&
    camera.position.z > -21.5 &&
    Math.abs(camera.position.x) < 11.4 &&
    camera.position.y < 4.9;
  insideLight = THREE.MathUtils.lerp(
    insideLight,
    interior ? 1 : 0,
    1 - Math.exp(-dt * 3),
  );
  renderer.toneMappingExposure = 0.98 + insideLight * 0.08;
  hemi.intensity = 1.25 - insideLight * 0.7;
  scene.fog.density = 0.002 - insideLight * 0.0015;
  world.flock.update(dt, camera.position, { reduced });
  world.duck.update(dt, camera.position, { reduced });
  if (!reduced) {
    world.windMaterials.forEach((s) => (s.uniforms.uTime.value = time));
    world.water.position.y = -0.31 + Math.sin(time * 0.5) * 0.01;
    world.waterNormal.offset.set(time * 0.008, time * 0.004);
    world.dust.rotation.y = Math.sin(time * 0.075) * 0.011;
    world.flames.forEach(
      (f, i) => (f.scale.y = 0.8 + Math.sin(time * 7 + i * 2) * 0.22),
    );
    world.firelight.intensity = 6 + Math.sin(time * 10) * 0.7;
  }
  const projected = new THREE.Vector3();
  hotspotElements.forEach(({ h, b }) => {
    if (
      !isBoardVisible(h.id, exhibition.values()) ||
      h.room !== room ||
      transition ||
      walking ||
      overview ||
      focus
    ) {
      b.hidden = true;
      return;
    }
    projected.copy(h.position).project(camera);
    const visible =
      projected.z < 1 &&
      projected.z > 0 &&
      Math.abs(projected.x) < 0.93 &&
      Math.abs(projected.y) < 0.85;
    b.hidden = !visible;
    if (visible) {
      b.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`;
      b.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`;
    }
  });
  for (const marker of roomFeatureElements) {
    if (
      marker.room !== room ||
      transition ||
      overview ||
      focus ||
      opening.active
    ) {
      marker.b.hidden = true;
      continue;
    }
    projected.copy(marker.position).project(camera);
    marker.b.hidden =
      projected.z <= 0 ||
      projected.z >= 1 ||
      Math.abs(projected.x) > 0.86 ||
      Math.abs(projected.y) > 0.83;
    if (!marker.b.hidden) {
      marker.b.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`;
      marker.b.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`;
    }
  }
  $("#plan-position").setAttribute(
    "cx",
    String(
      THREE.MathUtils.clamp(((camera.position.x + 11) / 22) * 100 + 6, 6, 106),
    ),
  );
  $("#plan-position").setAttribute(
    "cy",
    String(
      THREE.MathUtils.clamp(((camera.position.z + 21) / 34) * 136 + 6, 6, 151),
    ),
  );
  if (profile.bloom) composer.render();
  else renderer.render(scene, camera);
  if (frames === 3) {
    $("#loading").classList.add("done");
    opening.setReady();
  }
  if (frames === 45) renderer.shadowMap.autoUpdate = false;
  // Explicit quality choices are never silently lowered.
  if (
    graphicsChoice === "auto" &&
    !graphicsDegraded &&
    !previewMode &&
    frames > 120
  ) {
    frameTimes.push(dt);
    if (frameTimes.length > 90) frameTimes.shift();
    if (
      frameTimes.length === 90 &&
      frameTimes.reduce((a, b) => a + b, 0) / 90 > 0.037
    ) {
      graphicsDegraded = true;
      quality();
    }
  }
  if (performance.now() - lastPerformance > 2000) {
    $("#world").dataset.room = String(room);
    $("#world").dataset.mode = walking
      ? "walk"
      : overview
        ? "overview"
        : "guided";
    $("#world").dataset.ready = "true";
    lastPerformance = performance.now();
  }
}
$("#read-room").onclick = () => {
  $("#room-reader").classList.remove("composition-view", "presentation-view");
  stopTour();
  if (document.pointerLockElement) document.exitPointerLock();
  walking = false;
  updateUI();
  const r = ROOMS[room - 1],
    el = $("#room-reader-content");
  el.replaceChildren();
  const title = document.createElement("h1");
  title.textContent = `Room ${r.number} · ${r.title}`;
  el.append(title);
  const p = document.createElement("p");
  p.textContent = r.summary;
  el.append(p);
  for (const c of exhibition.roomEntries(room)) {
    const b = document.createElement("button");
    b.className = "room-entry-button";
    b.dataset.readerEntry = c.id;
    b.textContent = exhibition.title(c.id) + " ↗";
    b.onclick = () => {
      $("#room-reader").close();
      const h =
        world.hotspots.find((h) => h.id === c.id) ||
        world.hotspots.find((h) => h.id === c.id.replace("pair", "claim"));
      if (h) openArtifact(h);
      else {
        focus = { id: c.id };
        exhibition.show(c.id);
        $("#artifact-panel").show();
      }
    };
    el.append(b);
  }
  $("#room-reader").showModal();
};
function updatePresentationControls() {
  const r = ROOMS[room - 1];
  $("#presentation-controls").hidden = !presentationMode;
  $("#presentation-counter").textContent = r
    ? `ROOM ${r.number} / V`
    : "THE GROUNDS";
  $("#presentation-room-name").textContent = r
    ? r.feature
    : "The Douglass Exhibition";
  $("#presentation-feature").textContent = r
    ? `Open ${r.feature}`
    : "Enter the exhibition";
  $("#presentation-next").textContent =
    room === 5 ? "Title slide ↗" : "Next room →";
  $("#presentation-prev").disabled = room <= 1 || !!transition;
  $("#presentation-next").disabled = !!transition;
  $("#presentation-feature").disabled = !!transition;
  for (const id of ["#presentation-walk", "#walk-page"]) {
    $(id).textContent = walking ? "Back to room view" : "Walk around";
    $(id).setAttribute("aria-pressed", String(walking));
    $(id).disabled = !!transition;
  }
}
function setPresentationMode(enabled) {
  presentationMode = enabled;
  document.body.classList.toggle("presentation-mode", enabled);
  document.body.classList.remove("ui-hidden");
  stopTour();
  if ($("#room-reader").open) $("#room-reader").close();
  if ($("#artifact-panel").open) $("#artifact-panel").close();
  presentationEntry = null;
  const url = new URL(location.href);
  if (enabled) url.searchParams.set("mode", "presentation");
  else url.searchParams.delete("mode");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  updatePresentationControls();
}
function presentationRoom(direction) {
  if (transition) return;
  if ($("#room-reader").open) $("#room-reader").close();
  presentationEntry = null;
  if (room === 5 && direction > 0) {
    $("#replay-opening").click();
    return;
  }
  navigate(Math.max(1, Math.min(5, room + direction)));
}
function stepPresentation(direction) {
  if (transition) return;
  if (!$("#room-reader").open) {
    if (direction > 0 && room > 0) openRoomFeature();
    else presentationRoom(direction);
    return;
  }
  const entries = presentationEntries(room, exhibition.values());
  const index = entries.findIndex((c) => c.id === presentationEntry);
  if (direction > 0 && index >= entries.length - 1) {
    presentationRoom(1);
    return;
  }
  if (direction < 0 && index === -1) {
    $("#room-reader").close();
    return;
  }
  presentationEntry = entries[index + direction]?.id || null;
  renderRoomComposition();
  $("#room-reader").scrollTop = 0;
}
function renderRoomComposition() {
  const el = $("#room-reader-content"),
    r = ROOMS[room - 1],
    values = exhibition.values();
  lastCompositionValues = JSON.stringify(values);
  const focused = el.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusTarget = focused?.hasAttribute("data-page-prev")
    ? "[data-page-prev]"
    : focused?.hasAttribute("data-page-next")
      ? "[data-page-next]"
      : focused?.dataset.openEntry
        ? `[data-open-entry="${focused.dataset.openEntry}"]`
        : null;
  const entries = presentationEntries(room, values);
  if (presentationEntry && !entries.some((c) => c.id === presentationEntry))
    presentationEntry = null;
  const index = entries.findIndex((c) => c.id === presentationEntry);
  $("#room-reader").classList.toggle("presentation-view", presentationMode);
  if (presentationMode) {
    el.innerHTML =
      `<nav class="presentation-pages" aria-label="Room presentation pages"><button type="button" data-page-prev>${index < 0 ? "← Room view" : "← Back"}</button><span>${index < 0 ? r.feature : `${index + 1} / ${entries.length}`}</span><button type="button" data-page-next>${index >= entries.length - 1 ? (room === 5 ? "Title slide →" : "Next room →") : "Next entry →"}</button></nav>` +
      (presentationEntry
        ? presentationEntryHTML(presentationEntry, values)
        : compositionHTML(room, values, { audience: true }));
    el.querySelector("[data-page-prev]").onclick = () => stepPresentation(-1);
    el.querySelector("[data-page-next]").onclick = () => stepPresentation(1);
  } else {
    el.innerHTML =
      `<div class="feature-reader-actions"><a href="./editor.html#room=${room}&view=feature" target="_blank" rel="noopener">Edit ${r.feature} ↗</a><button type="button" id="present-feature-view">Present this room</button></div>` +
      compositionHTML(room, values);
    el.querySelector("#present-feature-view").onclick = () => {
      setPresentationMode(true);
      openRoomFeature();
    };
  }
  el.querySelectorAll("[data-open-entry]").forEach(
    (b) =>
      (b.onclick = () => {
        if (presentationMode) {
          presentationEntry = b.dataset.openEntry;
          renderRoomComposition();
          $("#room-reader").scrollTop = 0;
        } else {
          $("#room-reader").close();
          if (!isBoardVisible(b.dataset.openEntry, exhibition.values())) return;
          focus = { id: b.dataset.openEntry };
          exhibition.show(b.dataset.openEntry);
          $("#artifact-panel").show();
        }
      }),
  );
  if (focusTarget)
    el.querySelector(focusTarget)?.focus({ preventScroll: true });
}
function openRoomFeature() {
  if (room === 0) {
    navigate(1);
    return;
  }
  if (transition) return;
  stopTour();
  if (document.pointerLockElement) document.exitPointerLock();
  walking = false;
  updateUI();
  presentationEntry = null;
  $("#room-reader").classList.add("composition-view");
  renderRoomComposition();
  $("#room-reader").showModal();
}
$("#feature-room").onclick = openRoomFeature;
$("#presentation-feature").onclick = openRoomFeature;
$("#presentation-prev").onclick = () => presentationRoom(-1);
$("#presentation-next").onclick = () => presentationRoom(1);
$("#presentation-fullscreen").onclick = () => $("#fullscreen").click();
$("#exit-presentation").onclick = () => setPresentationMode(false);
$("#switch-presentation").onclick = () => {
  setPresentationMode(true);
  navigate(room || 1);
};
exhibition.store.subscribe(() => {
  if (
    $("#room-reader").open &&
    $("#room-reader").classList.contains("composition-view") &&
    lastCompositionValues !== JSON.stringify(exhibition.values())
  )
    renderRoomComposition();
});
$("#close-room-reader").onclick = () => $("#room-reader").close();
setPresentationMode(presentationMode);
updateUI();
animate();
if (initialRoom >= 1 && initialRoom <= 5 && !previewMode)
  setTimeout(() => navigate(initialRoom), 600);

// A live, read-only camera on the same museum geometry and textures used by visitors.
if (previewMode) {
  let previewSlot = "",
    previewShown = true;
  const message = document.createElement("div");
  message.id = "board-preview-message";
  message.textContent = "Preparing live board…";
  document.body.append(message);
  function frameBoard(slot) {
    const card = CARD_BY_ID[displayBinding(slot).card];
    room = card.room;
    transition = null;
    walking = overview = false;
    focus = null;
    const display = world.displays.find((d) => d.id === slot);
    if (display) {
      display.screen.updateWorldMatrix(true, false);
      const center = display.screen.getWorldPosition(new THREE.Vector3());
      const rotation = display.screen.getWorldQuaternion(
        new THREE.Quaternion(),
      );
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
      camera.fov = 45;
      camera.updateProjectionMatrix();
      const fitHeight = Math.max(display.height, display.width / camera.aspect);
      const distance =
        (fitHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) *
        1.3;
      setCamera(center.clone().addScaledVector(normal, distance), center);
      // Align with tilted tabletop boards as well as vertical wall panels.
      camera.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(rotation));
      camera.lookAt(center);
    } else {
      camera.up.set(0, 1, 0);
      const h = world.hotspots.find((h) => h.id === slot),
        view = views[room];
      const look = h?.position || vec(view.t),
        outward = vec(view.p).sub(look).normalize();
      setCamera(look.clone().addScaledVector(outward, 3.1), look);
    }
    $("#world").dataset.previewSlot = slot;
  }
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const data = previewMessage(e.data);
    if (!data) return;
    exhibition.setPreview(data.values);
    if (graphicsChoice !== data.quality) {
      graphicsChoice = data.quality;
      quality();
    }
    const visible = isBoardVisible(data.slot, data.values);
    if (previewSlot !== data.slot || previewShown !== visible) {
      previewSlot = data.slot;
      previewShown = visible;
      if (visible) frameBoard(data.slot);
      else {
        camera.up.set(0, 1, 0);
        room = CARD_BY_ID[data.card].room;
        setCamera(vec(views[room].p), vec(views[room].t));
      }
    }
    message.textContent = visible ? "" : "Board removed from exhibition";
    message.hidden = visible;
    $("#world").dataset.boardVisible = String(visible);
    renderer.shadowMap.needsUpdate = true;
  });
  window.addEventListener("resize", () => {
    if (previewSlot && previewShown) frameBoard(previewSlot);
  });
  window.parent.postMessage(
    { type: "douglass-preview-ready" },
    location.origin,
  );
}
