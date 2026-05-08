import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { Popover } from "~/_components/ui/popover";

export function BatchToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const [scale, setScale] = useState<1 | 2 | 4>(2);
  const [rotate, setRotate] = useState<0 | 90>(0);

  if (selectedIds.length === 0) return null;

  const buildUrl = (format: "png" | "svg") => {
    const params = new URLSearchParams({
      ids: selectedIds.join(","),
      format,
    });
    if (format === "png") params.set("scale", String(scale));
    if (rotate === 90) params.set("rotate", "90");
    return `/api/labels/batch-download?${params.toString()}`;
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 shadow-xl">
      <span className="text-sm">{selectedIds.length} selected</span>
      <Popover
        trigger={
          <Button size="sm" variant="primary">
            <Download className="h-4 w-4" /> Download
          </Button>
        }
        align="center"
      >
        <div className="w-64 space-y-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">PNG scale</p>
            <div className="flex gap-2">
              {[1, 2, 4].map((s) => (
                <Button key={s} size="sm" variant={scale === s ? "primary" : "secondary"} onClick={() => setScale(s as 1 | 2 | 4)}>
                  {s}×
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">Rotate</p>
            <div className="flex gap-2">
              <Button size="sm" variant={rotate === 0 ? "primary" : "secondary"} onClick={() => setRotate(0)}>0°</Button>
              <Button size="sm" variant={rotate === 90 ? "primary" : "secondary"} onClick={() => setRotate(90)}>90°</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a href={buildUrl("png")} className="rounded-lg bg-accent px-3 py-2 text-center text-sm hover:bg-accent-hover">PNG zip</a>
            <a href={buildUrl("svg")} className="rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm hover:bg-zinc-700">SVG zip</a>
          </div>
        </div>
      </Popover>
      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
