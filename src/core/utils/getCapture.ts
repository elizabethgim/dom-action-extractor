import html2canvas from "html2canvas";

async function captureScreenshot(el: HTMLElement, id: string, label: "before" | "after") {
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio,
  });
  return canvas.toDataURL(`${label}_image${id}/png`);
}


export async function captureState(label: "before" | "after", id:string) : Promise<imageState | null> {
  const target = getCaptureTarget();
  if (!target) return null;

  const dataUrl = await captureScreenshot(target, id, label);
  
  return {
    label,
    timestamp: Date.now(),
    image: dataUrl,
  };
}

export function getCaptureTarget(): HTMLElement | null {
  return (
    document.querySelector("svg")?.parentElement ??
    document.body
  );
}

export interface imageState{
  label: string,
  timestamp: number,
  image: string
}