
let tagRegistry: Element[] = [];

export function getTagRegistry(){
  return tagRegistry;
}

export function extractTags(container: HTMLElement){
  const svg = container.querySelector("svg");
  if(!svg) return;

  const treeWalker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
  
  let node: Element | null;
  while ((node = treeWalker.nextNode() as Element | null)) {
    tagRegistry.push(node);
  }
}



export async function waitForSvg(container: HTMLElement) {
  if (container.querySelector("svg")) return;

  await new Promise<void>((resolve) => {
    const obs = new MutationObserver(() => {
      if (container.querySelector("svg")) {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(container, { childList: true, subtree: true });
  });
}
