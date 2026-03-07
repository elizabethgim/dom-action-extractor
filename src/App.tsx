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

function App() {
  const [step, setStep] = useState(0);

  const chartIds = useMemo(() => Object.keys(chartRegistry) as ChartId[], []);
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elMapRef = useRef(new Map<string, Element>());

  const filters = useChartFilters(chartIds);
  const { renderedChartId, isRendering, renderChart, resetRendered } =
    useChartRenderer(containerRef);

  const { isRunning, stop } = useActionExtractorMachine(step);

  // const [extracted, setExtracted] = useState<ExtractedEl[]>([]);
  // const [hoverKey, setHoverKey] = useState<string | null>(null);


  // const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // const selected = useMemo(
  //   () => extracted.find((e) => e.key === selectedKey) ?? null,
  //   [extracted, selectedKey]
  // );

  // const overlayTargets = useMemo(() => {
  //   if (selected) return [selected];     // 선택됨 → 하나만
  //   return extracted;                    // 선택 없음 → 전체
  // }, [selected, extracted]);

  const { 
    extracted, setExtracted, 
    selectedKey, setSelectedKey, 
    hoverKey, setHoverKey,
    selected, 
    overlayTargets,
    clear
  } = useExtractionState(filters.selectedChartId);

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

      <section className="panel extractControlSection">
        <ActionExtractControlPanel 
        isRunning={isRunning}
        onExtract={async () => {
          // setStep((s) => s+1);

          // if(containerRef.current){
          //   await waitChartMountedAndGetAllElements(containerRef.current, {
          //   readySelector: "svg",
          //   quietMs: 200,
          //   timeoutMs: 8000,
          // }).then((elements) => {
          //   console.log("Collected elements count:", elements.length);
          //   const canvases = elements.filter((el) => el.tagName.toLowerCase() === "canvas");
          //   console.log("Canvases:", canvases);
          // })
          // } else {
          //   alert("No charts");
          //   return;
          // }

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
