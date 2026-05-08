import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { Popover } from "~/_components/ui/popover";

export function DownloadPopover({
  labelId,
  disabled,
}: {
  labelId: string | null;
  disabled?: boolean;
}) {
  const [scale, setScale] = useState<1 | 2 | 4>(2);
  const [rotate, setRotate] = useState<0 | 90>(0);

  const buildUrl = (format: "png" | "svg") => {
    if (!labelId) return "#";
    const params = new URLSearchParams();
    if (rotate === 90) params.set("rotate", "90");
    if (format === "png") params.set("scale", String(scale));
    return `/api/labels/${labelId}/download.${format}?${params.toString()}`;
  };

  return (
    <Popover
      trigger={
        <Button variant="secondary" disabled={disabled === true || !labelId}>
          <Download className="h-4 w-4" /> Download
        </Button>
      }
      align="end"
    >
      <div className="w-64 space-y-3">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">PNG scale</p>
          <div className="flex gap-2">
            {[1, 2, 4].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={scale === s ? "primary" : "secondary"}
                onClick={() => setScale(s as 1 | 2 | 4)}
              >
                {s}×
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">Rotate</p>
          <div className="flex gap-2">
            <Button size="sm" variant={rotate === 0 ? "primary" : "secondary"} onClick={() => setRotate(0)}>
              0°
            </Button>
            <Button size="sm" variant={rotate === 90 ? "primary" : "secondary"} onClick={() => setRotate(90)}>
              90°
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <a
            href={buildUrl("png")}
            className="rounded-lg bg-accent px-3 py-2 text-center text-sm hover:bg-accent-hover"
          >
            Download PNG
          </a>
          <a
            href={buildUrl("svg")}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm hover:bg-zinc-700"
          >
            Download SVG
          </a>
        </div>
      </div>
    </Popover>
  );
}
