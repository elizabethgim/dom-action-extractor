export interface IChartInfo{
    chartSummary?: {
        chartType: string;
        markTypes: string[];
        seriesCount: number;
    };
    axes: {
        x:{
            ticks: {
                text: string;
                bbox:{
                    left: number;
                    right: number;
                    top: number;
                    width: number;
                    height: number;
                }
            }[];
        };
        y:{
            ticks: {
                text: string;
                bbox: {
                    left: number;
                    right: number;
                    top: number;
                    width: number;
                    height: number;
                }
            }[];
        };
    };
    series:{
        seriesId: string;
        color: string;
        type: string;
        count: number;
        elements: {
            tag: string;
            bbox: {
                left: number;
                top: number;
                width: number;
                height: number;
            };
            d3Data?: unknown;
        }[];
    }[];
};