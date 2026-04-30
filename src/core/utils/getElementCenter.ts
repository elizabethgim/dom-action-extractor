export function getElementCenter(el: Element){
  const rect = (el as HTMLElement).getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}