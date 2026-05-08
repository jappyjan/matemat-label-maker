import Link from "next/link";
import { Trash2, Copy } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { cn } from "~/_components/ui/cn";
import type { LabelConfig } from "~/server/label/types";

export function LabelCard({
  label,
  selected,
  onToggleSelect,
  onDelete,
  onDuplicate,
}: {
  label: { id: string; name: string; config: LabelConfig; updatedAt: number };
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-zinc-900 p-3 transition-colors",
        selected ? "border-accent" : "border-zinc-800",
      )}
    >
      <label className="absolute left-3 top-3 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-zinc-950/80">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(label.id)}
          className="h-3.5 w-3.5"
        />
      </label>
      <Link href={`/edit/label/${label.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/matemat-label?id=${label.id}&kind=saved`}
          alt={label.name}
          className="aspect-[630/800] w-full rounded-md object-contain"
        />
        <p className="mt-2 truncate text-sm font-medium">{label.name}</p>
        <p className="text-[11px] text-zinc-500">
          {new Date(label.updatedAt).toLocaleDateString()}
        </p>
      </Link>
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        <Button variant="secondary" size="sm" onClick={() => onDuplicate(label.id)} aria-label="Duplicate">
          <Copy className="h-3 w-3" />
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(label.id)} aria-label="Delete">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
