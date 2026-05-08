import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const logos = sqliteTable("logos", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  recolorable: integer("recolorable", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const labels = sqliteTable("labels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  config: text("config").notNull(), // JSON-serialized LabelConfig
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  config: text("config").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type Logo = typeof logos.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
