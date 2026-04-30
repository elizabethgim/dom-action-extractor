

export function getChartTypePrompt(num: number, xAxis:string, yAxis: string, data: string){
  switch(num) {
    case 0:
      return `
        What kind of chart is this?
        This is a DOM element of the visualization.
      `;
    case 1:
      return `
        You are a Chart Question and Answering assistant for dynamic charts.
        I'll first give you the x axis.
        x-axis: ${xAxis}
      `;
    case 2:
      return `
      This is the y axis.
      y-axis: ${yAxis}
      `;
    case 3:
      return `
      This is part of the DOM elements from the chart.

      ${data}
      `

  }
    
}