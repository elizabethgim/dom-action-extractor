import { useMemo, useRef, useState } from 'react'

import '@styles/App.css'

import { ChartSelectPanel } from '@components/ChartSelectPanel';
import { ChartPanel } from '@components/ChartPanel';
import { ActionExtractControlPanel } from '@/components/ActionExtractControlPanel';
import { BoundingBoxOverlay } from '@/components/BoundingBoxOverlay';

import { chartRegistry, type ChartId } from '@core/charts/chartRegistry';
import { waitChartMountedAndGetAllElements } from '@core/actionExtractor/domCollector';

import { useChartFilters } from '@hooks/useChartFilters';
import { useChartRenderer } from '@hooks/useChartRenderer';
import { useActionExtractorMachine } from '@hooks/useActionExtractorMachine';


import type { ExtractedEl } from './types/ExtractedEl';
import { toContainerBBox } from './toContainerBBox';
import { cssPath } from './cssPath';
import { inferActionHints } from './inferActionHints';
import { ExtractionResultsPanel } from './components/ExtractionResultsPanel';
import { useExtractionState } from './hooks/useExtractionState';
import { getD3OnEntries } from './core/actionExtractor/d3On';
import { runD3On } from './core/actionExtractor/d3Run';
import { AxisPanel } from './components/AxesPanel';
import { extractAxes, type AxesResult } from './core/markExtractor/extractAxes';
import { extractPath } from './core/markExtractor/extractPath';
import { PathPanel } from './components/PathPanel';

function App() {
  const [step, setStep] = useState(0);

  const chartIds = useMemo(() => Object.keys(chartRegistry) as ChartId[], []);
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elMapRef = useRef(new Map<string, Element>());

  const filters = useChartFilters(chartIds);
  const { renderedChartId, isRendering, renderChart, resetRendered } =
    useChartRenderer(containerRef);

  const { isRunning, stop } = useActionExtractorMachine(step);

  const [axes, setAxes] = useState<AxesResult | null>(null);
  const [selectedXAxisIndex, setSelectedXAxisIndex] = useState<number | null>(null);
  const [selectedYAxisIndex, setSelectedYAxisIndex] = useState<number | null>(null);

  const { 
    extracted, setExtracted, 
    selectedKey, setSelectedKey, 
    hoverKey, setHoverKey,
    selected, 
    overlayTargets,
    clear
  } = useExtractionState(filters.selectedChartId);

  const [path, setPath] = useState<string[]>([]);

  return (
    <div className="stack">
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
          onRender={async () => {
            if (!filters.selectedChartId) return;
            await renderChart(filters.selectedChartId as ChartId)
              .catch((e) => alert(String(e)));

            const svg = containerRef.current?.querySelector<SVGSVGElement>("svg");
            if(!svg){
              setAxes(null);
              setSelectedXAxisIndex(null);
              setSelectedYAxisIndex(null);
              return;
            }

            const axis = extractAxes(svg);
            setAxes(axis);
            setSelectedXAxisIndex(axis.xAxis.length > 0? 0: null);
            setSelectedYAxisIndex(axis.yAxis.length > 0? 0: null);
            
            const path = extractPath(svg);
            setPath(path);

            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }}
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

      <section className="panel builderChart">
        <ChartPanel 
          containerRef={containerRef} 
          hasChart={Boolean(renderedChartId)}
          isRendering={isRendering}
          overlay={
            <BoundingBoxOverlay
              items={overlayTargets}
              hoverKey={hoverKey}
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
              setSelectedXAxisIndex(index);
            }}
          />

      </section>

      <section className="panel path">
        <PathPanel 
          path={path}
        ></PathPanel>
      </section>

      <section className="panel extractControlSection">
        <ActionExtractControlPanel 
        isRunning={isRunning}
        onExtract={async () => {
          setStep((s) => s + 1);
          
          const container = containerRef.current;
          if (!container) return alert("No charts");

          const elements = await waitChartMountedAndGetAllElements(container, {
            readySelector: "svg, canvas, iframe",
            quietMs: 200,
            timeoutMs: 8000,
          });

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
            });

            elMapRef.current.set(`${idx}`, el);
          });
          
          
          // 너무 많은 요소면 노이즈라서, 작은 박스 제거/상위 N개만 등 필터 추천
          setExtracted(out);
          setSelectedKey(out[0]?.key ?? null);
        }}
      />
      </section>
      
      <section className='panel '>
        <div style={{ marginTop: 12 }}>
          <ExtractionResultsPanel
            extracted={extracted}
            selectedKey={selectedKey}
            onSelect={(key:string) => {
                setSelectedKey(key);
                setHoverKey(null);
              }
            }
            onClear={() => {
              setExtracted([]);
              setSelectedKey(null);
            }}
            onRunD3={(key, type) => {
              const el = elMapRef.current.get(key);
              if (!el) return alert("Element not found");
              runD3On(el, type);
            }}
          />
        </div>
      </section>
    </div>
  )
}

export default App
