import { useRef, useState } from "react";

import "@styles/DebugPage.css";

import { ChartSelectPanel } from "@/components/builder/ChartSelectPanel";
import { ChartPanel } from "@/components/builder/ChartPanel";
import { ActionExtractControlPanel } from "@/components/extracter/ActionExtractControlPanel";
import { BoundingBoxOverlay } from "@/components/extracter/BoundingBoxOverlay";

import type { ChartId } from "@/core/charts/chartRegistry";
import { waitChartMountedAndGetAllElements } from "@/core/actionExtractor/domCollector";

import { useChartFilters } from "@/hooks/useChartFilters";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { useChartRenderer } from "@/hooks/useChartRenderer";
import { useActionExtractorMachine } from "@/hooks/useActionExtractorMachine";

import type { ExtractedEl } from "../types/ExtractedEl";
import { toContainerBBox } from "../toContainerBBox";
import { cssPath } from "../cssPath";
import { inferActionHints } from "../inferActionHints";
import { ExtractionResultsPanel } from "../components/extracter/ExtractionResultsPanel";
import { useExtractionState } from "../hooks/useExtractionState";
import { getD3OnEntries } from "@/core/actionExtractor/d3On";
import { runD3On } from "@/core/actionExtractor/d3Run";
import { AxisPanel } from "../components/extracter/AxesPanel";
import { extractAxes, type AxesResult } from "../core/markExtractor/extractAxes";
import { extractPath } from "@/core/markExtractor/extractPath";
import { PathPanel } from "../components/extracter/PathPanel";
import { extractDataMarks } from "@/core/markExtractor/extractDataMarks";
import { mapToResults } from "@/core/markExtractor/mapToResults";
import { getHookEntries } from "@/core/actionExtractor/hookEntries";
import { generateChartElements } from "../core/prompts/chartRecognition";


function DebugPage() {
  const [step, setStep] = useState(0);

  const { charts: chartCatalog, isLoadingCharts, chartCatalogError } = useChartCatalog();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const elMapRef = useRef(new Map<string, Element>());

  const filters = useChartFilters(chartCatalog);
  const { renderedChartId, isRendering, renderChart, resetRendered } =
    useChartRenderer(containerRef);

  const { isRunning, stop } = useActionExtractorMachine(step);

  const [axes, setAxes] = useState<AxesResult | null>(null);
  const [selectedXAxisIndex, setSelectedXAxisIndex] = useState<number | null>(
    null,
  );
  const [selectedYAxisIndex, setSelectedYAxisIndex] = useState<number | null>(
    null,
  );

  const {
    extracted,
    setExtracted,
    selectedKey,
    setSelectedKey,
    hoverKey,
    setHoverKey,
    overlayTargets,
    dataExtracted,
    setDataExtracted,
    selectedDataKey,
    setSelectedDataKey,
    clear,
  } = useExtractionState(filters.selectedChartId);

  const [path, setPath] = useState<string[]>([]);
  const dataElMapRef = useRef(new Map<string, Element>()); // 데이터용 Map 추가
  
  const handleRender = async () => {
      if (!filters.selectedChartId) return;
      await renderChart(filters.selectedChartId as ChartId).catch((e) =>
        alert(String(e)),
      );

      const svg = containerRef.current?.querySelector<HTMLElement>("svg");
      if (!svg) {
        setAxes(null);
        setSelectedXAxisIndex(null);
        setSelectedYAxisIndex(null);
        return;
      }

      // 축 추출
      const axis = extractAxes(svg);
      console.log("x: ", axis.xAxis);
      console.log("y: ", axis.yAxis);

      setAxes(axis);

      setSelectedXAxisIndex(axis.xAxis.length > 0 ? 0 : null);
      setSelectedYAxisIndex(axis.yAxis.length > 0 ? 0 : null);

      // path 추출
      const path = extractPath(svg);
      setPath(path);
      
      console.log("paths: ", path);

      // 데이터 마크 추출을 위한 축 요소 Set 생성
      const axisElements = new Set(
        axis.allTicks.map((t) => t.element).filter(Boolean),
      );

      //  데이터 마크 추출 실행 (차트 렌더링 직후 자동 실행)
      const series = extractDataMarks(svg, axisElements);

      console.log("data marks: ", series);
      
      // ExtractionReulstsPanel 형식에 맞게 변환하여 저장
      const dataMarksForPanel: ExtractedEl[] = series.flatMap((s) =>
        s.elements.map((el, idx) => {
          const key = `${s.seriesId}-${idx}`;
          dataElMapRef.current.set(key, el.element);
          
          const calculatedBbox = toContainerBBox(
            containerRef.current!,
            el.element as HTMLElement,
          );

          return {
            key: key,
            tag: el.tag.toLowerCase(),
            bbox: calculatedBbox ?? { x: 0, y: 0, w: 0, h: 0 },
            selector: cssPath(el.element as HTMLElement),
            depth: 0,
            actionHints: [`Series: ${s.color}`],
            d3On: getD3OnEntries(el.element),
            element: el.element
          };
        }),
      );

      setDataExtracted(dataMarksForPanel);

      const chartInfo = mapToResults(axis, path, dataMarksForPanel);
      console.log("chartInfo: ", chartInfo);
      console.log(JSON.stringify(chartInfo));
      
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    
    const handelExtract = async () => {
      setStep((s) => s + 1);
      
      const container = containerRef.current;
      if (!container) return alert("No charts");

      const elements = await waitChartMountedAndGetAllElements(
        container,
        {
          readySelector: "svg, canvas, iframe",
          quietMs: 200,
          timeoutMs: 8000,
        },
      );

      const out: ExtractedEl[] = [];
      elMapRef.current.clear();

      elements.forEach((el, idx) => {
        const bbox = toContainerBBox(container, el as HTMLElement);
        if (!bbox) return;

        const key = `${idx}`;
        elMapRef.current.set(key, el);

        out.push({
          key: `${idx}`,
          tag: el.tagName.toLowerCase(),
          selector: cssPath(el),
          bbox,
          depth: el.querySelectorAll("*").length,
          actionHints: inferActionHints(el as HTMLElement),
          d3On: getD3OnEntries(el),
          element: el,
          listeners: getHookEntries(el)
        });

        elMapRef.current.set(`${idx}`, el);
      });
      generateChartElements(container)

      // 너무 많은 요소면 노이즈라서, 작은 박스 제거/상위 N개만 등 필터 추천
      setExtracted(out);
      setSelectedKey(out[0]?.key ?? null);
    };

  return (
    <div className="debugPage">
      <ChartSelectPanel
        source={filters.source}
        setSource={filters.setSource}
        family={filters.family}
        setFamily={filters.setFamily}
        selectedChartId={filters.selectedChartId}
        setSelectedChartId={filters.setSelectedChartId}
        sources={filters.sources}
        families={filters.families}
        charts={filters.charts}
        isLoadingCharts={isLoadingCharts}
        chartCatalogError={chartCatalogError}
        onRender={handleRender}
        renderedChartId={renderedChartId}
        isRunning={isRunning}
        isRendering={isRendering}
        onSourceChanged={() => {
          if (isRunning) stop();
          resetRendered();
          filters.setSelectedChartId("");
          filters.setSelectedQuestionIndex(0);
        }}
      />

      <section className="panel debugChart">
        <ChartPanel
          containerRef={containerRef}
          hasChart={Boolean(renderedChartId)}
          isRendering={isRendering}
          overlay={
            <BoundingBoxOverlay
              items={overlayTargets}
              hoverKey={hoverKey}
              selectedKey={selectedKey}
              selectedDataKey={selectedDataKey}
              onHover={setHoverKey}
            />
          }
        />
      </section>

      <section className="panel axis">
        <AxisPanel
          title="X Axis"
          axis={axes?.xAxis ?? []}
          selectedIndex={selectedXAxisIndex}
          onSelect={(index) => {
            setSelectedXAxisIndex(index);
          }}
        />

        <AxisPanel
          title="Y Axis"
          axis={axes?.yAxis ?? []}
          selectedIndex={selectedYAxisIndex}
          onSelect={(index) => {
            setSelectedYAxisIndex(index);
          }}
        />
      </section>

      <section className="panel path">
        <PathPanel path={path}></PathPanel>
      </section>

      <section className="panel datamarks">
        <h3>Data Marks List</h3>
        <ExtractionResultsPanel
          extracted={dataExtracted}
          selectedKey={selectedDataKey}
          onSelect={(key) => {
            setSelectedKey(null);
            setSelectedDataKey(key);
            setHoverKey(null);
          }}
          onClear={() => {
            setDataExtracted([]);
          }}
          onRunD3={(key, type) => {
            const el = dataElMapRef.current.get(key);
            if (el) runD3On(el, type);
          }}
        />
      </section>

      <section className="panel extractControlSection">
        <ActionExtractControlPanel
          isRunning={isRunning}
          onExtract={handelExtract}
        />
      </section>

      <section className="panel actionResults">
        <div style={{ marginTop: 12 }}>
          <ExtractionResultsPanel
            extracted={extracted}
            selectedKey={selectedKey}
            onSelect={(key: string) => {
              setSelectedKey(key);
              setSelectedDataKey(null);
              setHoverKey(null);
            }}
            onClear={() => {
              setExtracted([]);
              setSelectedKey(null);
            }}
            onRunD3={(key, type) => {
              const el = elMapRef.current.get(key);
              if (!el) return alert("Element not found");
              const options = {clientX: 10, clientY: 1000};
              runD3On(el, type, options);
            }}
          />
        </div>
      </section>
    </div>
  );
}

export default DebugPage;
