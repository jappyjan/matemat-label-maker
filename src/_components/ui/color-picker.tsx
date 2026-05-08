import { HexColorPicker } from "react-colorful";
import { Popover } from "./popover";

const PRESETS = ["#000000", "#ffffff", "#1e1e1e", "#f5f5f5", "#1d4ed8", "#16a34a", "#dc2626", "#f59e0b"];

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover
      trigger={
        <button
          className="flex w-full items-center gap-3 rounded-lg bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
          aria-label={`${label}: ${value}`}
        >
          <span
            className="h-6 w-6 rounded border border-zinc-700"
            style={{ backgroundColor: value }}
          />
          <span className="flex-1 text-left text-sm">{label}</span>
          <span className="font-mono text-xs text-zinc-400">{value}</span>
        </button>
      }
    >
      <div className="space-y-3">
        <HexColorPicker color={value} onChange={onChange} />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
            else if (next.startsWith("#")) onChange(next);
          }}
          onBlur={(e) => {
            if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(value);
          }}
          className="w-full rounded-md bg-zinc-800 px-2 py-1 text-sm font-mono"
          maxLength={7}
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className="h-6 w-6 rounded border border-zinc-700"
              style={{ backgroundColor: preset }}
              aria-label={`Pick ${preset}`}
            />
          ))}
        </div>
      </div>
    </Popover>
  );
}
