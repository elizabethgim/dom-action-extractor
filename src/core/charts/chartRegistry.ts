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
  stackedAreaLine,
  multiLineHover,
  employ
} from "@datasets/index";


export const chartRegistry: Record<string, RenderFunction> = {
  "8f645c0f": collapsibleTree,
  "23688ae5": defineZoomAreaChart,
  "9e91daa0": defineMultiLine,
  "1f58f654": defineIndexChart,
  "dcc3634d": defineIcicle,
  "def56758": defineZoomCircle,
  "7acf6e8a": defineBivoriate,

  "f6dda5d0": multiLine,
  "8dc4a50a": MeanBarChart,
  "c86cd4ac": hierarchicalBarChart,

  "0550b7b7": zoomSunburst,
  "9c66f1e5": stackedAreaLine,
  "6ceadaea": multiLineHover,
  "ecb14d77": employ,
};
