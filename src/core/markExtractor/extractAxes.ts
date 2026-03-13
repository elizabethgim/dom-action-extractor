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
        right: bbox.right,
        top: bbox.top,
        width: bbox.width,
        height: bbox.height
      }
    });
  });

  console.log(axis);
  
  const byY = new Map<number, IAxis[]>(); // 같은 top 좌표
  const byX = new Map<number, IAxis[]>(); // 같은 left 좌표

  for (const tick of axis){
    const yKey = Math.floor(tick.bbox.top / 5); // y
    const xKey = Math.floor(tick.bbox.right / 5); // x

    if(!byY.has(yKey)) byY.set(yKey, []);
    if(!byX.has(xKey)) byX.set(xKey, []);

    byY.get(yKey)!.push(tick);
    byX.get(xKey)!.push(tick);
  }

  let xAxis: IAxis[] = [];
  let yAxis: IAxis[] = [];
  
  for (const group of byY.values()){
    if(group.length > xAxis.length) xAxis = group;
  }

  for(const group of byX.values()){
    if(group.length > yAxis.length) yAxis = group;
  }
  
  return { xAxis, yAxis, allTicks: axis };
}