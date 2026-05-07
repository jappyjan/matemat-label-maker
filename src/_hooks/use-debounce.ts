import { useEffect, useState } from "react";

export function useDebounce<T>(generator: () => T | Promise<T>, delay: number) {
  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void Promise.resolve(generator()).then(setResult);
    }, delay);

    return () => clearTimeout(timeout);
  }, [generator, delay]);

  return result;
}
