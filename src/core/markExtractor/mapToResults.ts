import type { ExtractedEl } from "@/types/ExtractedEl";
import type { IAxis } from "../models/interface/IAxis";
import type { IChartInfo } from "../models/interface/IChartInfo";

export interface IAxesResult {
  xAxis: IAxis[];
  yAxis: IAxis[];
  allTicks: IAxis[];
}

export function mapToResults(
  axis: IAxesResult,
  path: string[],
  dataMarks: ExtractedEl[]
): IChartInfo {

  const result: IChartInfo = {
    axes: {
      x: {
        ticks: axis.xAxis.map((a) => ({
          text: a.text,
          bbox: {
            left: a.bbox.left,
            right: a.bbox.right,
            top: a.bbox.top,
            width: a.bbox.width,
            height: a.bbox.height,
          },
        })),
      },
      y: {
        ticks: axis.yAxis.map((a) => ({
          text: a.text,
          bbox: {
            left: a.bbox.left,
            right: a.bbox.right,
            top: a.bbox.top,
            width: a.bbox.width,
            height: a.bbox.height,
          },
        })),
      },
    },
    series: dataMarks.map((mark, idx) => ({
      seriesId: `series-${idx}`,
      color:
        mark.element.getAttribute("fill") ||
        mark.element.getAttribute("stroke") ||
        "unknown",
      type: mark.tag,
      count: 1,
      elements: [
        {
          tag: mark.tag,
          bbox: {
            left: mark.bbox.x,
            top: mark.bbox.y,
            width: mark.bbox.w,
            height: mark.bbox.h,
          },
          d3Data: (mark.element as Element & { __data__?: unknown }).__data__,
        },
      ],
    })),
  };

  return result;
}

