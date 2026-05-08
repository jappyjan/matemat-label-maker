import { ColorPicker } from "~/_components/ui/color-picker";
import type { LabelConfig } from "~/server/label/types";

export function ColorSection({
  config,
  onChange,
}: {
  config: LabelConfig;
  onChange: (next: LabelConfig) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Colors</h2>
      <ColorPicker
        label="Background"
        value={config.colors.background}
        onChange={(c) => onChange({ ...config, colors: { ...config.colors, background: c } })}
      />
      <ColorPicker
        label="Foreground"
        value={config.colors.foreground}
        onChange={(c) => onChange({ ...config, colors: { ...config.colors, foreground: c } })}
      />
    </section>
  );
}
