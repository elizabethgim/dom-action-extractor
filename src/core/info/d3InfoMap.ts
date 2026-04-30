// src/core/charts/info/d3InfoMap.ts
import type { ChartInfo } from "@/core/models/types/chartInfoTypes";

// chartId -> ChartInfo
export const d3InfoMap: Record<string, Omit<ChartInfo, "chartId" | "sourceType">> = {
  "dataset:collapsible-tree":{
    title: "Collapsible tree",
    description: "Click a black node to expand or collapse the tree. ",
    tags: ["Tree", "hierarchical"],
    source: "D3 Gallery / Mike Bostock",
  },
  "dataset:multiple-line":{
    title: "Line chart, multiple series",
    description: "This line chart shows the unemployment rate of various U.S. metro divisions from 2000 through 2013. On hover, the closest data point to the pointer and its associated series is highlighted. Data: Bureau of Labor Statistics",
    tags: ["Line", "Multiple", "Series"],
    source:  "D3 Gallery / Mike Bostock",
  },
  "dataset:mean-bar-chart":{
    title: "Mean Line Bar Chart",
    description: "Inspired by Vega-Lite example. The plot below uses an interval selection, which causes the chart to include an interactive brush (shown in grey). The brush selection parameterizes the red guideline, which visualizes the average value within the selected interval.",
    tags: ["Bar"],
    source:  "D3 Gallery / Mike Bostock",
  },
  "dataset:hierarchical-bar":{
    title: "",
    description: "",
    tags: ["Hierarchical"],
    source:  "D3 Gallery / Mike Bostock",
  },
  "csv:zoomable-sunburst": {
    title: "",
    description: "",
    tags: ["Hierarchical"],
    source:  "D3 Gallery / Mike Bostock",
  }
};