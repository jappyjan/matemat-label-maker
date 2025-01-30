import { useEffect, useState } from "react";

export function useDebounce<T>(generator: () => Promise<T>, delay: number) {
  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      generator().then(setResult);
    }, delay);

    return () => clearTimeout(timeout);
  }, [generator, delay]);

  return result;
}
