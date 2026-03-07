import type { IAxis } from "../models/interface/IAxis";

export interface AxesResult {
  xAxis: IAxis[];
  yAxis: IAxis[];
  allTicks: IAxis[];
}

export function extractAxes(svg: SVGSVGElement): AxesResult{
  const ticks =  Array.from(svg.querySelectorAll(".tick"));
  let axis: IAxis[] = [];

  ticks.forEach(tick => {
    // const transform = tick.getAttribute("transform");
    const bbox = tick.getBoundingClientRect();
    const textEl = tick.querySelector("text");

    axis.push({
      text: textEl?.textContent ?? "",
      bbox: {
        left: bbox.left,
        top: bbox.top,
        width: bbox.width,
        height: bbox.height
      }
    });
  });

  const byY = new Map<number, IAxis[]>();
  const byX = new Map<number, IAxis[]>();

  for (const tick of axis){
    const yKey = Math.round(tick.bbox.top);
    const xKey = Math.round(tick.bbox.left);

    if(!byY.has(yKey)) byY.set(yKey, []);
    if(!byX.has(xKey)) byX.set(xKey, []);

    byY.get(yKey)!.push(tick);
    byX.get(xKey)!.push(tick);
  }

  let xAxis: IAxis[] = [];
  let yAxis: IAxis[] = [];
  
  for (const [, group] of byY){
    if(group.length > xAxis.length) xAxis = group;
  }

  for(const [, group] of byX){
    if(group.length > yAxis.length) yAxis = group;
  }

  return { xAxis, yAxis, allTicks: axis };
}