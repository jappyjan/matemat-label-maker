import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, Trash2, Edit2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "~/_components/ui/button";

interface Logo {
  id: string;
  filename: string;
  mimeType: string;
  recolorable: boolean;
  createdAt: number;
}

export default function LogosPage() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/logos");
    if (res.ok) setLogos((await res.json()) as Logo[]);
  }

  useEffect(() => { void refresh(); }, []);

  const onDrop = async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/logos", { method: "POST", body: fd });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `upload failed (${res.status})`);
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const dz = useDropzone({
    onDrop: (files) => { void onDrop(files); },
    accept: { "image/svg+xml": [".svg"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    multiple: true,
  });

  const rename = async (id: string, current: string) => {
    const next = prompt("New filename", current);
    if (!next || next === current) return;
    await fetch(`/api/logos/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: next }),
    });
    await refresh();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/logos/${id}`, { method: "DELETE" });
    if (res.status === 409) {
      const body = (await res.json()) as { labelCount: number; draftCount: number };
      const force = confirm(
        `Used by ${body.labelCount} label(s) and ${body.draftCount} draft(s). Force-delete (will clear logo from those)?`,
      );
      if (!force) return;
      await fetch(`/api/logos/${id}?force=true`, { method: "DELETE" });
    }
    await refresh();
  };

  return (
    <>
      <Head>
        <title>Logos — Matemat</title>
      </Head>
      <main className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex items-center gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Gallery
          </Link>
          <h1 className="text-2xl font-bold">Logos</h1>
        </header>

        <div
          {...dz.getRootProps()}
          className="mb-6 cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 p-8 text-center hover:border-zinc-500"
        >
          <input {...dz.getInputProps()} />
          <p className="text-sm">
            {busy ? "Uploading…" : "Drop SVG / PNG / JPEG here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Up to 10 MB per file.</p>
        </div>
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        {logos.length === 0 ? (
          <p className="text-sm text-zinc-500">No logos yet. Upload above.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {logos.map((logo) => (
              <div key={logo.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex h-32 items-center justify-center rounded bg-zinc-950 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/logos/${logo.id}/file`}
                    alt={logo.filename}
                    className="max-h-full max-w-full"
                  />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{logo.filename}</p>
                    <p className="text-xs text-zinc-500">
                      {logo.recolorable ? "Recolorable SVG" : logo.mimeType}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void rename(logo.id, logo.filename)} aria-label="Rename">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(logo.id)} aria-label="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
