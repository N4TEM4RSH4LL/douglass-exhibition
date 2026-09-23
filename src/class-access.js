/** Accept a key or a copied invitation, without navigating to pasted URLs. */
export function extractAccessKey(input) {
  let key = String(input || "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (/^https?:\/\//i.test(key)) {
    try {
      key = new URLSearchParams(new URL(key).hash.slice(1)).get("access") || "";
    } catch {
      return "";
    }
  }
  return key.replace(/^class (?:access )?(?:key|code):\s*/i, "").trim();
}

// Only the new human-readable class code uses this normalization. Previously
// issued random invitation tokens remain case-sensitive and keep working.
export function normalizeClassCode(input) {
  return extractAccessKey(input)
    .toUpperCase()
    .replace(/[\s\-\u2010-\u2015\u2212]/g, "");
}
