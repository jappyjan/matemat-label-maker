import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { DraftCard } from "~/_components/gallery/draft-card";
import { LabelCard } from "~/_components/gallery/label-card";
import { BatchToolbar } from "~/_components/gallery/batch-toolbar";
import type { LabelConfig } from "~/server/label/types";

interface Draft { id: string; config: LabelConfig; updatedAt: number; }
interface Label { id: string; name: string; config: LabelConfig; updatedAt: number; }

export default function Home() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function refresh() {
    const [draftsRes, labelsRes] = await Promise.all([
      fetch("/api/drafts").then((r) => r.json() as Promise<Draft[]>),
      fetch("/api/labels").then((r) => r.json() as Promise<Label[]>),
    ]);
    setDrafts(draftsRes);
    setLabels(labelsRes);
  }

  useEffect(() => { void refresh(); }, []);

  const newLabel = async () => {
    const res = await fetch("/api/drafts", { method: "POST" });
    const { id } = (await res.json()) as { id: string };
    await router.push(`/edit/draft/${id}`);
  };

  const deleteDraft = async (id: string) => {
    await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    setDrafts((d) => d.filter((x) => x.id !== id));
  };
  const deleteLabel = async (id: string) => {
    if (!confirm("Delete this label?")) return;
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
    setLabels((l) => l.filter((x) => x.id !== id));
    setSelected((s) => { const next = new Set(s); next.delete(id); return next; });
  };
  const duplicateLabel = async (id: string) => {
    const original = labels.find((l) => l.id === id);
    if (!original) return;
    const draft = (await fetch("/api/drafts", { method: "POST" }).then((r) => r.json())) as { id: string };
    await fetch(`/api/drafts/${draft.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(original.config),
    });
    await fetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId: draft.id, name: `${original.name} (copy)` }),
    });
    await refresh();
  };
  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <Head>
        <title>Matemat Label Maker</title>
      </Head>
      <main className="mx-auto max-w-6xl p-6">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Matemat Labels</h1>
          <div className="flex gap-2">
            <Link href="/logos">
              <Button variant="secondary">
                <ImageIcon className="h-4 w-4" /> Logos
              </Button>
            </Link>
            <Button onClick={() => void newLabel()}>
              <Plus className="h-4 w-4" /> New label
            </Button>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Drafts</h2>
          {drafts.length === 0 ? (
            <p className="text-sm text-zinc-500">No drafts yet.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {drafts.map((d) => (
                <DraftCard key={d.id} draft={d} onDelete={(id) => void deleteDraft(id)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Saved labels</h2>
          {labels.length === 0 ? (
            <p className="text-sm text-zinc-500">No saved labels yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {labels.map((l) => (
                <LabelCard
                  key={l.id}
                  label={l}
                  selected={selected.has(l.id)}
                  onToggleSelect={toggleSelect}
                  onDelete={(id) => void deleteLabel(id)}
                  onDuplicate={(id) => void duplicateLabel(id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BatchToolbar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />
    </>
  );
}
