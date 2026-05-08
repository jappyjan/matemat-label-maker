import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog } from "~/_components/ui/dialog";
import { Button } from "~/_components/ui/button";

interface Logo {
  id: string;
  filename: string;
  mimeType: string;
  recolorable: boolean;
}

export function LogoPickerDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/logos");
    if (res.ok) setLogos((await res.json()) as Logo[]);
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const onDrop = async (files: File[]) => {
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/logos", { method: "POST", body: fd });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `upload failed (${res.status})`);
          continue;
        }
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const dz = useDropzone({
    onDrop: (files) => { void onDrop(files); },
    accept: { "image/svg+xml": [".svg"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    multiple: true,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose logo">
      <div className="space-y-4">
        <div
          {...dz.getRootProps()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-zinc-700 p-6 text-center text-sm hover:border-zinc-500"
        >
          <input {...dz.getInputProps()} />
          {uploading ? "Uploading…" : "Drop SVG / PNG / JPEG here, or click to browse"}
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="grid grid-cols-3 gap-3 max-h-[360px] overflow-y-auto">
          <button
            onClick={() => { onSelect(null); onOpenChange(false); }}
            className={`flex h-24 items-center justify-center rounded-lg border ${selectedId === null ? "border-accent bg-zinc-800" : "border-zinc-700"} text-sm`}
          >
            No logo
          </button>
          {logos.map((logo) => (
            <button
              key={logo.id}
              onClick={() => { onSelect(logo.id); onOpenChange(false); }}
              className={`flex h-24 items-center justify-center rounded-lg border bg-zinc-900 p-2 ${selectedId === logo.id ? "border-accent" : "border-zinc-700"}`}
              title={logo.filename}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/logos/${logo.id}/file`} alt={logo.filename} className="max-h-full max-w-full object-contain" />
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}
