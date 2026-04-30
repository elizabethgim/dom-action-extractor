import { getActionHistory } from "@/core/actionExtractor/actionLogger";
import { extractActions } from "@/core/actionExtractor/extractActions";
import { useEffect, useRef, useState } from "react";

export function useActionExtractorMachine(step: number){
  const [isRunning, setIsRunning] = useState(false);
  const prevStepRef = useRef(step);

  useEffect(() => {
    if (step === prevStepRef.current) return;
    prevStepRef.current = step;

    let cancelled = false;

    const run = async () => {
      try {
        setIsRunning(true);
        await extractActions(step);
        const actionRegistry = await getActionHistory();
        console.log("[Action] ", actionRegistry);

      } finally {
        if (!cancelled) setIsRunning(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [step]);

  const stop = () => {
    setIsRunning(false);
  }

  return { isRunning, stop };
}