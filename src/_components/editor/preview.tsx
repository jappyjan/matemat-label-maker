import { useState } from "react";
import { Button } from "~/_components/ui/button";
import { cn } from "~/_components/ui/cn";

export function LabelPreview({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className="flex flex-1 items-center justify-center rounded-xl border border-zinc-800 p-4"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "shadow-2xl transition-all",
            zoom === "fit" ? "max-h-full max-w-full" : "max-w-none",
          )}
          style={zoom === "actual" ? { width: 630, height: 800 } : undefined}
        />
      </div>
      <div className="flex justify-center gap-2">
        <Button
          variant={zoom === "fit" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setZoom("fit")}
        >
          Fit
        </Button>
        <Button
          variant={zoom === "actual" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setZoom("actual")}
        >
          100%
        </Button>
      </div>
    </div>
  );
}
