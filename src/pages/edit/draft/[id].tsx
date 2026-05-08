import type { GetServerSideProps } from "next";
import { eq } from "drizzle-orm";
import { EditorPage } from "~/_components/editor/editor-page";
import { getDb } from "~/server/db/client";
import { drafts } from "~/server/db/schema";
import { labelConfigSchema, type LabelConfig } from "~/server/label/types";

interface Props {
  id: string;
  initial: { name: string; config: LabelConfig };
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = ctx.params?.id;
  if (typeof id !== "string") return { notFound: true };
  const db = getDb();
  const row = (await db.select().from(drafts).where(eq(drafts.id, id)).limit(1))[0];
  if (!row) return { notFound: true };
  return {
    props: {
      id,
      initial: {
        name: "",
        config: labelConfigSchema.parse(JSON.parse(row.config) as unknown),
      },
    },
  };
};

export default function DraftEdit({ id, initial }: Props) {
  return <EditorPage id={id} kind="draft" initial={initial} />;
}
