import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useDebouncedSave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  delay = 500,
): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    setState("idle");
    const timeout = setTimeout(() => {
      setState("saving");
      save(latest.current)
        .then(() => setState("saved"))
        .catch(() => setState("error"));
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay, save]);

  return state;
}
