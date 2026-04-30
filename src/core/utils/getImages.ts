import type { imageState } from "./getCapture";

export function getImages(before: imageState | null, after: imageState | null): string[] {
  const images: string[] = [];

  if (before) {
    images.push(
      removePrefix(before.image)
    );
  }

  if (after) {
    images.push(
      removePrefix(after.image)
    );
  }

  return images;
}

export function removePrefix(image: string){
  return image.replace(/^data:image\/png;base64,/, "");
}