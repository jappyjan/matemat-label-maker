import { useState } from "react";
import { Button } from "~/_components/ui/button";
import { LogoPickerDialog } from "./logo-picker-dialog";
import type { LabelConfig } from "~/server/label/types";

export function LogoSection({
  config,
  onChange,
}: {
  config: LabelConfig;
  onChange: (next: LabelConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Logo</h2>
      <div className="flex items-center gap-3 rounded-lg bg-zinc-900 p-3">
        <div className="flex h-16 w-16 items-center justify-center rounded border border-zinc-700 bg-zinc-950">
          {config.logoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logos/${config.logoId}/file`} alt="logo" className="max-h-full max-w-full" />
          ) : (
            <span className="text-xs text-zinc-500">none</span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Choose logo
        </Button>
      </div>
      <LogoPickerDialog
        open={open}
        onOpenChange={setOpen}
        selectedId={config.logoId}
        onSelect={(id) => onChange({ ...config, logoId: id })}
      />
    </section>
  );
}
