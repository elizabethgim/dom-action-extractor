
export function extractPath(svg: SVGSVGElement): string[]{
  const paths=Array.from(svg.querySelectorAll("path"));
  let dd: string[] = [];

  paths.forEach(path => {
    const d = path.getAttribute("d")?.toString();
    dd.push(d);
  })

  return dd;
}