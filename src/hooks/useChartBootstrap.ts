import { useRef } from "react";
import { hook } from "../core/actionExtractor/hook";

export function useChartBootstrap() {
  const bootstrappedRef = useRef(false);

  async function bootstrapOnce() {
    if (bootstrappedRef.current) return;
    await hook();
    bootstrappedRef.current = true;
  }

  return { bootstrapOnce };
}