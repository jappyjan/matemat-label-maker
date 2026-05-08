import { useCallback, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { LabelPreview } from "./preview";
import { TextSection } from "./text-section";
import { ColorSection } from "./color-section";
import { LogoSection } from "./logo-section";
import { DownloadPopover } from "./download-popover";
import { useDebouncedSave } from "~/_hooks/use-debounced-save";
import { type LabelConfig } from "~/server/label/types";

interface Props {
  id: string;
  kind: "draft" | "saved";
  initial: { name: string; config: LabelConfig };
}

export function EditorPage({ id, kind, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [config, setConfig] = useState<LabelConfig>(initial.config);
  const [previewBust, setPreviewBust] = useState(0);

  const save = useCallback(
    async (value: { name: string; config: LabelConfig }) => {
      if (kind === "draft") {
        await fetch(`/api/drafts/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(value.config),
        });
      } else {
        await fetch(`/api/labels/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: value.name, config: value.config }),
        });
      }
      setPreviewBust((n) => n + 1);
    },
    [id, kind],
  );

  const saveValue = useMemo(() => ({ name, config }), [name, config]);
  const saveState = useDebouncedSave(saveValue, save, 500);

  const previewSrc = `/api/matemat-label?id=${id}&kind=${kind}&v=${previewBust}`;

  const promote = async () => {
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: id, name: name || "Untitled label" }),
    });
    if (res.ok) {
      const body = (await res.json()) as { id: string };
      await router.replace(`/edit/label/${body.id}`);
    }
  };

  return (
    <>
      <Head>
        <title>{name || "Untitled label"} — Matemat</title>
      </Head>
      <div className="grid h-screen grid-cols-1 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-4 p-6 overflow-hidden">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Gallery
            </Link>
            <span className="text-xs text-zinc-500">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "•"}
            </span>
          </header>
          <LabelPreview src={previewSrc} alt={name || "Label preview"} />
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-zinc-400">Label name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled label"
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-base font-medium focus:bg-zinc-800"
              disabled={kind === "draft"}
            />
            {kind === "draft" ? (
              <p className="text-[11px] text-zinc-500">Save to give this label a name.</p>
            ) : null}
          </div>

          <TextSection config={config} onChange={setConfig} />
          <ColorSection config={config} onChange={setConfig} />
          <LogoSection config={config} onChange={setConfig} />

          <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-zinc-800">
            {kind === "draft" ? (
              <Button onClick={() => void promote()}>
                <Save className="h-4 w-4" /> Save label
              </Button>
            ) : null}
            <DownloadPopover labelId={kind === "saved" ? id : null} disabled={kind === "draft"} />
            {kind === "draft" ? (
              <p className="text-[11px] text-zinc-500">Save before downloading.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
