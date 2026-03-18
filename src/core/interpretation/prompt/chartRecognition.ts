import { extractAxes } from "@/core/markExtractor/extractAxes";
import { extractDataMarks } from "@/core/markExtractor/extractDataMarks";

export async function generateChartElements(container: SVGSVGElement){
  const axis = extractAxes(container);
  const axisElements = new Set(
    axis.allTicks.map((t) => t.element).filter(Boolean),
  );
  const dataMarks = extractDataMarks(container, axisElements);

  return `
  This is a interactive chart made by d3.js.

  current visual x axis are: ${axis.xAxis}
  current visual y axis are: ${axis.yAxis}
  and the datas are shown: ${dataMarks}

  What kind of chart is this?

  The result should be formated like this:
  {
    "chartType" : "Bar"
  }
  NO additional explanation.
  `; 
}