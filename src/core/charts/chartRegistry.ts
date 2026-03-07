import { observableAdapter } from "./observableAdapter.js";
import { iframeAdapter } from "./iframeAdpater.js";
import { d3Adapter } from "./d3Adapter.js";

import {
  collapsibleTree,
  defineZoomAreaChart,
  multiLine,
  defineMultiLine,
  defineIndexChart,
  defineBivoriate,
  defineIcicle,
  defineZoomCircle,
  hierarchicalBarChart,
  MeanBarChart,
  lineHoverChart,
  zoomSunburst,
} from "@datasets/index";

export const chartRegistry = {
  "dataset:collapsible-tree": d3Adapter(
    collapsibleTree,
    "collapsible-tree"
  ),

  "observable:zoom-area": observableAdapter(
    defineZoomAreaChart,
    "zoom-area"
  ),

 "observable:multiple-line": observableAdapter(
    defineMultiLine,
    "multi-line"
  ),

  "observable:index-line": observableAdapter(
    defineIndexChart,
    "index-line"
  ),

  "observable:zoomable-icicle": observableAdapter(
    defineIcicle,
    "zoomable-icicle"
  ),

  "observable:zoomable-circle-packing": observableAdapter(
    defineZoomCircle,
    "zoomable-icicle"
  ),
  
  "observable:bivariate-choropleth": observableAdapter(
    defineBivoriate,
    "bivariate-choropleth"
  ),
  "dataset:multiple-line": d3Adapter(
    multiLine,
    "multi-line"
  ),

  "dataset:mean-bar-chart": d3Adapter(
    MeanBarChart,
    "mean-bar"
  ),

  "dataset:hierarchical-bar": d3Adapter(
    hierarchicalBarChart,
    "hier-bar"
  ),

  "csv:zoomable-sunburst" : d3Adapter (
    zoomSunburst,
    "zoom-sunburst"
  ),
  "tableau:wall-e": iframeAdapter(
    "/tableau/wall-e/index.html"
  ),
} as const;

export type ChartId = keyof typeof chartRegistry;
