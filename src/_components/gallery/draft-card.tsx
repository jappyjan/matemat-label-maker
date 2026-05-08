import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "~/_components/ui/button";
import type { LabelConfig } from "~/server/label/types";

export function DraftCard({
  draft,
  onDelete,
}: {
  draft: { id: string; config: LabelConfig; updatedAt: number };
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group relative w-44 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-2">
      <Link href={`/edit/draft/${draft.id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/matemat-label?id=${draft.id}&kind=draft`}
          alt="Draft"
          className="aspect-[630/800] w-full rounded-md object-contain"
        />
        <p className="mt-2 truncate text-xs text-zinc-400">
          {draft.config.name || "Untitled"}
        </p>
        <p className="text-[11px] text-zinc-500">
          {new Date(draft.updatedAt).toLocaleString()}
        </p>
      </Link>
      <Button
        variant="danger"
        size="sm"
        className="absolute right-2 top-2 hidden group-hover:inline-flex"
        onClick={() => onDelete(draft.id)}
        aria-label="Delete draft"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
