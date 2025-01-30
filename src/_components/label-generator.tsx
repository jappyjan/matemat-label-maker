"use client";

import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "~/_hooks/use-debounce";

export function LabelGenerator() {
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({
    name: "",
    size: "",
    price: "",
    footerLine1: "",
    footerLine2: "",
  });

  const setPlaceholder = useCallback((key: string, value: string) => {
    setPlaceholders((prev) => ({ ...prev, [key]: value }));
  }, []);

  const labelURLGenerator = useCallback(() => {
    const searchParams = new URLSearchParams();
    Object.entries(placeholders).forEach(([key, value]) => {
      searchParams.append(key, value);
    });

    return `/api/matemat-label?${searchParams.toString()}`;
  }, [placeholders]);

  const labelURL = useDebounce(labelURLGenerator, 1000);

  return (
    <div className="w-full max-w-xs text-white">
      <div className="flex flex-col gap-2">
        {Object.entries(placeholders).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <label>
              <span className="text-lg">{key}</span>
              <input
                type="text"
                placeholder="Value"
                value={value}
                onChange={(e) => setPlaceholder(key, e.target.value)}
                className="w-full rounded-full px-4 py-2 text-black"
              />
            </label>
          </div>
        ))}
      </div>

      <br />
      <br />

      {/* eslint-disable-next-line @next/next/no-img-element*/}
      <img src={labelURL} alt="Label" className="w-full max-w-xs" />
    </div>
  );
}
