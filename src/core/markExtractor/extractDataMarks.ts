export function extractDataMarks(
  svg: SVGSVGElement,
  axisElements: Set<Element>,
) {
  const allElements = Array.from(svg.querySelectorAll("path, circle, rect"));

  const dataElements = allElements.filter((el) => !axisElements.has(el));
  const seriesMap = new Map<string, Element[]>();

  dataElements.forEach((el) => {
    const style = window.getComputedStyle(el);
    const colorKey =
      el.getAttribute("fill") ||
      style.fill ||
      el.getAttribute("stroke") ||
      style.stroke;

    if (!seriesMap.has(colorKey)) seriesMap.set(colorKey, []);
    seriesMap.get(colorKey)?.push(el);
  });

  const extractedSeries = Array.from(seriesMap.entries()).map(
    ([color, elements], idx) => ({
      seriesId: `series-${idx}`,
      color,
      count: ElementInternals.length,
      type: elements[0].tagName.toLowerCase(),
      elements: elements.map((el) => ({
        tag: el.tagName,
        bbox: el.getBoundingClientRect(),
        d3Data: (el as any).__data__,
        element: el,
      })),
    }),
  );

  return extractedSeries;
}
