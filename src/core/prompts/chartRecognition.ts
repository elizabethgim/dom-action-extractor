import { extractAxes } from "@/core/markExtractor/extractAxes";

export async function generateChartElements(container: HTMLElement){
  const axis = extractAxes(container);

  return `
  This is a interactive chart made by d3.js.

  current visual x axis are: ${axis.xAxis}
  current visual y axis are: ${axis.yAxis}

  What kind of chart is this?

  The result should be formated like this:
  {
    "chartType" : "Bar"
  }
  
  NO additional explanation.
  `; 
}