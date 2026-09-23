import { API_BASE } from "./shared-store.js";
export function mediaURL(value) {
  return /^media:[a-f0-9]{64}$/.test(value || "")
    ? `${API_BASE}/api/media?id=${value.slice(6)}`
    : "";
}
export async function uploadImage(file, token) {
  if (!token) throw Error("Enter the class key before uploading.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPEG, PNG or WebP photo.");
  if (file.size > 20000000) throw Error("Choose a photo smaller than 20 MB.");
  const image = await createImageBitmap(file);
  if (image.width * image.height > 60000000) {
    image.close();
    throw Error("This photo is too large to process.");
  }
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  let data = canvas.toDataURL("image/webp", 0.82);
  if (data.length > 1300000) data = canvas.toDataURL("image/webp", 0.55);
  if (data.length > 1300000) throw Error("Please choose a smaller image.");
  const response = await fetch(`${API_BASE}/api/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ image: data }),
  });
  const body = await response.json();
  if (!response.ok) throw Error(body.error || "Upload failed. Try again.");
  return body.reference;
}
