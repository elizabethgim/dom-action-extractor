
export function extractPath(svg: HTMLElement): string[]{
  const paths=Array.from(svg.querySelectorAll("path"));
  const dd: string[] = [];

  paths.forEach(path => {
    const d = path.getAttribute("d")?.toString();
    dd.push(d);
  })

  return dd;
}