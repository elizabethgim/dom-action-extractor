import html2canvas from "html2canvas";
import type { imageState } from "@core/models/interface/IimageState";

async function captureScreenshot(el: HTMLElement) {
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 1,
  });
  return canvas.toDataURL("image/jpeg", 0.75);
}


export async function captureState(label: "before" | "after", _id: string, el?: HTMLElement | null): Promise<imageState | null> {
  const target = el ?? getCaptureTarget();
  if (!target) return null;

  const dataUrl = await captureScreenshot(target);

  return {
    label,
    timestamp: Date.now(),
    image: dataUrl,
  };
}

export function getCaptureTarget(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".chartMount") ?? document.body;
}
