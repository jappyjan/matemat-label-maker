import { fitFontSize } from "~/server/label/fit-font";
import { SLOTS } from "~/server/label/slots";
import type { LabelConfig } from "~/server/label/types";

const FIELDS: Array<{ key: keyof Pick<LabelConfig, "name" | "size" | "price" | "footerLine1" | "footerLine2">; label: string; slot: keyof typeof SLOTS }> = [
  { key: "name", label: "Name", slot: "name" },
  { key: "size", label: "Size", slot: "size" },
  { key: "price", label: "Price", slot: "price" },
  { key: "footerLine1", label: "Footer line 1", slot: "footerLine1" },
  { key: "footerLine2", label: "Footer line 2", slot: "footerLine2" },
];

export function TextSection({
  config,
  onChange,
}: {
  config: LabelConfig;
  onChange: (next: LabelConfig) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Text</h2>
      {FIELDS.map(({ key, label, slot }) => {
        const value = config[key];
        const slotMeta = SLOTS[slot];
        const fitted = fitFontSize(value, slotMeta.width, slotMeta.defaultFontSize, 24);
        const shrunk = value.length > 0 && fitted < slotMeta.defaultFontSize;
        return (
          <label key={key} className="block">
            <span className="mb-1 block text-xs text-zinc-400">{label}</span>
            <input
              value={value}
              onChange={(e) => onChange({ ...config, [key]: e.target.value })}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm focus:bg-zinc-800"
              placeholder={label}
            />
            {shrunk ? (
              <p className="mt-1 text-[11px] italic text-amber-500">
                auto-shrunk to fit ({fitted}px)
              </p>
            ) : null}
          </label>
        );
      })}
    </section>
  );
}
