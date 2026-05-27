import html2canvas from "html2canvas";
import type { imageState } from "@core/models/interface/IimageState";

async function captureScreenshot(el: HTMLElement, id: string, label: "before" | "after") {
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio,
  });
  return canvas.toDataURL(`${label}_image${id}/png`);
}


export async function captureState(label: "before" | "after", id: string, el?: HTMLElement | null): Promise<imageState | null> {
  const target = el ?? getCaptureTarget();
  if (!target) return null;

  const dataUrl = await captureScreenshot(target, id, label);

  return {
    label,
    timestamp: Date.now(),
    image: dataUrl,
  };
}

export function getCaptureTarget(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".chartMount") ?? document.body;
}
