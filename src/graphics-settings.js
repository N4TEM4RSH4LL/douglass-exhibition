export const GRAPHICS_PRESETS = {
  low: {
    label: "Low",
    ratio: 0.8,
    shadows: 0,
    bloom: false,
    anisotropy: 1,
    boards: 512,
    fps: 30,
    dust: false,
    description:
      "For older laptops and phones. Reduced resolution, no shadows or bloom, and a 30 FPS limit.",
  },
  balanced: {
    label: "Balanced",
    ratio: 1,
    shadows: 1024,
    bloom: false,
    anisotropy: 4,
    boards: 1024,
    fps: 60,
    dust: false,
    description: "Clear displays with lighter shadows and a 60 FPS limit.",
  },
  high: {
    label: "High",
    ratio: 1.65,
    shadows: 2048,
    bloom: true,
    anisotropy: 8,
    boards: 1536,
    fps: 60,
    dust: true,
    description: "Sharper displays, detailed shadows, bloom and floating dust.",
  },
  maximum: {
    label: "Maximum",
    ratio: 2.5,
    shadows: 4096,
    bloom: true,
    anisotropy: 16,
    boards: 2048,
    fps: 0,
    dust: true,
    description:
      "Supersampling, 4K shadows, the sharpest board textures and no frame-rate cap. Uses more GPU power.",
  },
};
export function graphicsProfile(
  choice,
  {
    touch = false,
    degraded = false,
    maxTextureSize = 4096,
    maxAnisotropy = 16,
  } = {},
) {
  const id =
    choice === "auto"
      ? degraded
        ? "low"
        : touch
          ? "balanced"
          : "high"
      : Object.hasOwn(GRAPHICS_PRESETS, choice)
        ? choice
        : "high";
  const preset = GRAPHICS_PRESETS[id];
  return {
    ...preset,
    id,
    shadows: Math.min(preset.shadows, maxTextureSize),
    anisotropy: Math.min(preset.anisotropy, maxAnisotropy),
  };
}
export function savedGraphics() {
  try {
    const value = localStorage.getItem("douglass-graphics-v1");
    return value === "auto" || Object.hasOwn(GRAPHICS_PRESETS, value)
      ? value
      : "auto";
  } catch {
    return "auto";
  }
}
