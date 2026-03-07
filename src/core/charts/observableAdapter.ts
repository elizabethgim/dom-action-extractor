import { Runtime } from "@observablehq/runtime";
import { Inspector } from "@observablehq/inspector";
import { Library, FileAttachments } from "@observablehq/stdlib";

export function observableAdapter(define: any, id: string) {
  return {
    id,
    async mount(container: HTMLElement) {
      // ✅ stdlib built-ins (d3, DOM, FileAttachment, require...) 주입
      const library = new Library();
      const runtime = new Runtime(library);

      // export가 기대하는 runtime.fileAttachments
      runtime.fileAttachments = (resolve: (name: string) => any) =>
        FileAttachments((name: string) => {
          const r = resolve(name);
          if (r == null) return null;
          if (typeof r === "string" || r?.then) return { url: r };
          return r;
        });

      const main = runtime.module(define, (name: string) => {
        if (name === "chart") return new Inspector(container);
        return null;
      });

      await main.value("chart");

      // (선택) unmount에서 dispose 하려면 참조 저장
      (this as any)._runtime = runtime;
    },

    async unmount(container: HTMLElement) {
      // ✅ runtime dispose까지 해주면 타이머/observer/resize 등도 정리됨
      (this as any)._runtime?.dispose?.();
      container.replaceChildren();
    },
  };
}