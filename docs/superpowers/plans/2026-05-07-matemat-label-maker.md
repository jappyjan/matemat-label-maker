# Matemat Label Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the matemat label maker per the design spec at `docs/superpowers/specs/2026-05-07-matemat-label-maker-design.md`: dynamic SVG generation, SQLite persistence for labels/drafts/logos, logo upload library with optional SVG recoloring, full UI rewrite, and PNG/SVG/zip downloads.

**Architecture:** Next.js 14 pages router app. Drizzle + better-sqlite3 for persistence with files on disk under `/data`. Pure server-side `renderLabelSvg` builds a complete SVG from a `LabelConfig`, served at `/api/labels/<id>/svg` and consumed by the existing og-image-generator container for PNG output. UI rewritten with Radix primitives + Tailwind, two-pane editor + gallery + logos pages.

**Tech Stack:** TypeScript (strict), Next.js 14 (pages router), Tailwind, Drizzle ORM, better-sqlite3, Radix Dialog/Popover, react-colorful, react-dropzone, lucide-react, formidable, jszip, nanoid, vitest, node-mocks-http.

**Conventions:**
- Path alias `~/*` → `src/*`
- All paths below are relative to the repo root unless absolute
- TDD where the unit is testable as a pure function or HTTP handler. UI is verified manually.
- Each task ends with a commit. Commit messages use conventional prefixes (`feat:`, `chore:`, `test:`, `refactor:`).

---

## Phase A — Infrastructure

### Task A1: Add testing framework

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json` (scripts + devDependencies)

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vitest @vitest/coverage-v8 node-mocks-http @types/node-mocks-http
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import { afterEach } from "vitest";

afterEach(() => {
  // Per-test cleanup hooks register here as needed.
});
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `scripts` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Sanity test**

Create `tests/sanity.test.ts`:

```ts
import { expect, test } from "vitest";

test("sanity", () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
git commit -m "chore: add vitest"
```

---

### Task A2: Add data dependencies

**Files:**
- Modify: `package.json` (deps)

- [ ] **Step 1: Install runtime deps**

```bash
npm install better-sqlite3 drizzle-orm nanoid formidable jszip @radix-ui/react-dialog @radix-ui/react-popover react-colorful lucide-react react-dropzone
```

- [ ] **Step 2: Install dev deps**

```bash
npm install --save-dev drizzle-kit @types/better-sqlite3 @types/formidable
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add drizzle, radix, and form deps"
```

---

### Task A3: Configure environment variables

**Files:**
- Modify: `src/env.js`
- Create: `.env.example`

- [ ] **Step 1: Update `src/env.js`**

Replace the `server` and `runtimeEnv` blocks:

```js
server: {
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_PATH: z.string().default("./data/matemat.db"),
  UPLOADS_DIR: z.string().default("./data/uploads"),
  GENERATOR_URL: z.string().url(),
  GENERATOR_USER: z.string(),
  GENERATOR_PASS: z.string(),
  INTERNAL_BASE_URL: z.string().url(),
},
client: {},
runtimeEnv: {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_PATH: process.env.DATABASE_PATH,
  UPLOADS_DIR: process.env.UPLOADS_DIR,
  GENERATOR_URL: process.env.GENERATOR_URL ?? process.env.NEXT_PUBLIC_GENERATOR_URL,
  GENERATOR_USER: process.env.GENERATOR_USER ?? process.env.NEXT_PUBLIC_GENERATOR_USER,
  GENERATOR_PASS: process.env.GENERATOR_PASS ?? process.env.NEXT_PUBLIC_GENERATOR_PASS,
  INTERNAL_BASE_URL: process.env.INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL,
},
```

The fallback to `NEXT_PUBLIC_*` lets the existing docker-compose keep working until updated in Task F2.

- [ ] **Step 2: Create `.env.example`**

```bash
NODE_ENV=development
DATABASE_PATH=./data/matemat.db
UPLOADS_DIR=./data/uploads
GENERATOR_URL=http://localhost:3003/og-image.png
GENERATOR_USER=matemat
GENERATOR_PASS=devpass
INTERNAL_BASE_URL=http://localhost:3000
```

- [ ] **Step 3: Add `data/` to `.gitignore`**

Append to `.gitignore`:

```
/data
```

- [ ] **Step 4: Commit**

```bash
git add src/env.js .env.example .gitignore
git commit -m "feat: env vars for db, uploads, generator"
```

---

### Task A4: Drizzle schema + migrations

**Files:**
- Create: `src/server/db/schema.ts`
- Create: `drizzle.config.ts`
- Create: `drizzle/migrations/0000_init.sql` (generated)
- Modify: `package.json` (db:generate script)

- [ ] **Step 1: Create `src/server/db/schema.ts`**

```ts
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
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
} satisfies Config;
```

- [ ] **Step 3: Add db:generate script to `package.json`**

```json
"db:generate": "drizzle-kit generate"
```

- [ ] **Step 4: Generate the initial migration**

Run: `npm run db:generate -- --name init`
Expected: a SQL file appears at `drizzle/migrations/0000_init.sql` containing `CREATE TABLE` statements for `logos`, `labels`, `drafts`.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle.config.ts drizzle/ package.json
git commit -m "feat: drizzle schema + initial migration"
```

---

### Task A5: Database client + auto-migrate on boot

**Files:**
- Create: `src/server/db/client.ts`
- Create: `tests/helpers/test-db.ts`
- Create: `tests/server/db/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/server/db/client.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb } from "~/server/db/client";

describe("createDb", () => {
  test("creates the database file and runs migrations on first call", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "matemat-test-"));
    try {
      const dbPath = path.join(dir, "test.db");
      const { db, sqlite } = createDb({ databasePath: dbPath });
      const tables = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);
      expect(names).toContain("logos");
      expect(names).toContain("labels");
      expect(names).toContain("drafts");
      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/server/db/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/db/client.ts`**

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";

import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(options: { databasePath: string }) {
  mkdirSync(path.dirname(options.databasePath), { recursive: true });
  const sqlite = new Database(options.databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve("drizzle/migrations") });

  return { db, sqlite };
}

let cached: { db: Db; sqlite: Database.Database } | null = null;

export function getDb(): Db {
  if (cached) return cached.db;
  const databasePath = process.env.DATABASE_PATH ?? "./data/matemat.db";
  cached = createDb({ databasePath });
  return cached.db;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/server/db/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `tests/helpers/test-db.ts`** (used in later API tests)

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db } from "~/server/db/client";
import type Database from "better-sqlite3";

export interface TestDb {
  db: Db;
  sqlite: Database.Database;
  cleanup: () => void;
}

export function setupTestDb(): TestDb {
  const dir = mkdtempSync(path.join(tmpdir(), "matemat-test-"));
  const dbPath = path.join(dir, "test.db");
  const { db, sqlite } = createDb({ databasePath: dbPath });
  return {
    db,
    sqlite,
    cleanup: () => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/server/db/client.ts tests/server/db/client.test.ts tests/helpers/test-db.ts
git commit -m "feat: db client with auto-migrate"
```

---

## Phase B — Render core

### Task B1: Slot constants

**Files:**
- Create: `src/server/label/slots.ts`

- [ ] **Step 1: Create `src/server/label/slots.ts`**

```ts
export interface SlotBox {
  x: number;
  y: number;        // baseline y for text, top y for logo image
  width: number;
  height: number;
  defaultFontSize: number;
}

export const CANVAS = { width: 630, height: 800 } as const;

export const SLOTS = {
  name:        { x: 120, y: 136.409, width: 510, height: 120, defaultFontSize: 96 },
  size:        { x: 245, y: 216.773, width: 380, height: 60,  defaultFontSize: 42 },
  logo:        { x: 120, y: 260,     width: 390, height: 240, defaultFontSize: 0  },
  price:       { x: 235, y: 537.773, width: 380, height: 60,  defaultFontSize: 42 },
  footerLine1: { x: 173, y: 693.773, width: 450, height: 60,  defaultFontSize: 42 },
  footerLine2: { x: 170, y: 774.773, width: 450, height: 60,  defaultFontSize: 42 },
} satisfies Record<string, SlotBox>;

export type SlotKey = keyof typeof SLOTS;
```

- [ ] **Step 2: Commit**

```bash
git add src/server/label/slots.ts
git commit -m "feat: label slot bounding boxes"
```

---

### Task B2: Inter glyph width table + fitFontSize

**Files:**
- Create: `src/server/label/glyph-widths.ts`
- Create: `src/server/label/fit-font.ts`
- Create: `tests/server/label/fit-font.test.ts`

- [ ] **Step 1: Create `src/server/label/glyph-widths.ts`**

This table is the average glyph advance width for Inter at 1em. Values are approximations averaged across the Inter regular weight; precision-to-the-pixel isn't required because `textLength`/`lengthAdjust` is the safety net at render time.

```ts
// Average glyph advance widths for Inter (regular) at 1em.
// Unknown glyphs fall back to FALLBACK_WIDTH.
export const FALLBACK_WIDTH = 0.55;

export const GLYPH_WIDTHS: Record<string, number> = {
  " ": 0.28, "!": 0.30, '"': 0.42, "#": 0.62, "$": 0.55, "%": 0.83,
  "&": 0.66, "'": 0.22, "(": 0.33, ")": 0.33, "*": 0.42, "+": 0.55,
  ",": 0.27, "-": 0.34, ".": 0.27, "/": 0.40,
  "0": 0.55, "1": 0.55, "2": 0.55, "3": 0.55, "4": 0.55, "5": 0.55,
  "6": 0.55, "7": 0.55, "8": 0.55, "9": 0.55,
  ":": 0.27, ";": 0.27, "<": 0.55, "=": 0.55, ">": 0.55, "?": 0.46,
  "@": 0.93,
  "A": 0.66, "B": 0.66, "C": 0.69, "D": 0.71, "E": 0.59, "F": 0.55,
  "G": 0.74, "H": 0.72, "I": 0.27, "J": 0.51, "K": 0.62, "L": 0.55,
  "M": 0.85, "N": 0.74, "O": 0.76, "P": 0.62, "Q": 0.76, "R": 0.62,
  "S": 0.61, "T": 0.59, "U": 0.71, "V": 0.65, "W": 0.92, "X": 0.62,
  "Y": 0.59, "Z": 0.59,
  "[": 0.33, "\\": 0.40, "]": 0.33, "^": 0.50, "_": 0.50, "`": 0.40,
  "a": 0.55, "b": 0.58, "c": 0.52, "d": 0.58, "e": 0.55, "f": 0.34,
  "g": 0.58, "h": 0.58, "i": 0.24, "j": 0.24, "k": 0.51, "l": 0.24,
  "m": 0.86, "n": 0.58, "o": 0.57, "p": 0.58, "q": 0.58, "r": 0.37,
  "s": 0.49, "t": 0.36, "u": 0.58, "v": 0.49, "w": 0.74, "x": 0.49,
  "y": 0.49, "z": 0.49,
  "{": 0.33, "|": 0.24, "}": 0.33, "~": 0.55,
  "€": 0.55, "£": 0.55, "¥": 0.55, "©": 0.83,
  "ä": 0.55, "ö": 0.57, "ü": 0.58, "Ä": 0.66, "Ö": 0.76, "Ü": 0.71, "ß": 0.58,
};
```

- [ ] **Step 2: Write failing tests for `fitFontSize`**

Create `tests/server/label/fit-font.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { measureTextWidth, fitFontSize } from "~/server/label/fit-font";

describe("measureTextWidth", () => {
  test("scales linearly with font size", () => {
    const w20 = measureTextWidth("Hello", 20);
    const w40 = measureTextWidth("Hello", 40);
    expect(w40).toBeCloseTo(w20 * 2, 1);
  });

  test("empty string is zero", () => {
    expect(measureTextWidth("", 50)).toBe(0);
  });
});

describe("fitFontSize", () => {
  test("returns default size when text fits", () => {
    expect(fitFontSize("Hi", 1000, 96, 24)).toBe(96);
  });

  test("shrinks until it fits", () => {
    const fitted = fitFontSize(
      "an extremely long product name that overflows",
      300,
      96,
      24,
    );
    expect(fitted).toBeLessThan(96);
    expect(measureTextWidth("an extremely long product name that overflows", fitted)).toBeLessThanOrEqual(300);
  });

  test("never goes below minimum", () => {
    expect(fitFontSize("x".repeat(500), 10, 96, 24)).toBe(24);
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npm test -- tests/server/label/fit-font.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/server/label/fit-font.ts`**

```ts
import { GLYPH_WIDTHS, FALLBACK_WIDTH } from "./glyph-widths";

export function measureTextWidth(text: string, fontSize: number): number {
  let total = 0;
  for (const char of text) {
    total += GLYPH_WIDTHS[char] ?? FALLBACK_WIDTH;
  }
  return total * fontSize;
}

export function fitFontSize(
  text: string,
  maxWidth: number,
  defaultSize: number,
  minSize: number,
): number {
  if (text.length === 0) return defaultSize;
  if (measureTextWidth(text, defaultSize) <= maxWidth) return defaultSize;
  for (let size = defaultSize; size >= minSize; size--) {
    if (measureTextWidth(text, size) <= maxWidth) return size;
  }
  return minSize;
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- tests/server/label/fit-font.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/label/glyph-widths.ts src/server/label/fit-font.ts tests/server/label/fit-font.test.ts
git commit -m "feat: fitFontSize with Inter glyph widths"
```

---

### Task B3: SVG recoloring helper

**Files:**
- Create: `src/server/label/recolor-svg.ts`
- Create: `tests/server/label/recolor-svg.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/server/label/recolor-svg.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { recolorSvg, extractSvgInner } from "~/server/label/recolor-svg";

const SAMPLE_SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <path d="M10 10 H 90 V 90 H 10 Z" fill="black" />
  <circle cx="50" cy="50" r="20" fill="#000" />
  <rect width="10" height="10" />
</svg>`;

describe("recolorSvg", () => {
  test("replaces fill attributes with target color", () => {
    const out = recolorSvg(SAMPLE_SVG, "#ff0000");
    expect(out).toContain('fill="#ff0000"');
    expect(out).not.toContain('fill="black"');
    expect(out).not.toContain('fill="#000"');
  });

  test("adds fill to elements that lack it", () => {
    const out = recolorSvg(SAMPLE_SVG, "#ff0000");
    expect(out).toMatch(/<rect [^>]*fill="#ff0000"/);
  });
});

describe("extractSvgInner", () => {
  test("returns viewBox and inner content", () => {
    const result = extractSvgInner(SAMPLE_SVG);
    expect(result.viewBox).toBe("0 0 100 100");
    expect(result.inner).toContain("<path");
    expect(result.inner).not.toContain("<svg");
  });

  test("falls back to width/height when no viewBox", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="60"><rect /></svg>';
    expect(extractSvgInner(svg).viewBox).toBe("0 0 50 60");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/server/label/recolor-svg.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/label/recolor-svg.ts`**

```ts
const FILL_ATTR = /\sfill\s*=\s*("[^"]*"|'[^']*')/g;
const SVG_OPEN = /<svg\b[^>]*>/i;
const SVG_CLOSE = /<\/svg>/i;
const PAINTABLE_TAGS = [
  "path", "circle", "ellipse", "rect", "polygon", "polyline", "line", "text",
];

export function recolorSvg(svg: string, color: string): string {
  let out = svg.replace(FILL_ATTR, ` fill="${color}"`);

  for (const tag of PAINTABLE_TAGS) {
    const opener = new RegExp(`<${tag}\\b([^>]*)>`, "g");
    out = out.replace(opener, (match, attrs: string) => {
      if (/\sfill\s*=/.test(attrs)) return match;
      return `<${tag}${attrs} fill="${color}">`;
    });
  }

  return out;
}

export function extractSvgInner(svg: string): { viewBox: string; inner: string } {
  const openMatch = SVG_OPEN.exec(svg);
  const closeMatch = SVG_CLOSE.exec(svg);
  if (!openMatch || !closeMatch) {
    return { viewBox: "0 0 100 100", inner: svg };
  }
  const openTag = openMatch[0];
  const inner = svg.slice(openMatch.index + openTag.length, closeMatch.index);

  const viewBoxMatch = /viewBox\s*=\s*"([^"]+)"/i.exec(openTag);
  if (viewBoxMatch?.[1]) {
    return { viewBox: viewBoxMatch[1], inner };
  }
  const widthMatch = /\swidth\s*=\s*"([^"]+)"/i.exec(openTag);
  const heightMatch = /\sheight\s*=\s*"([^"]+)"/i.exec(openTag);
  const w = widthMatch?.[1] ?? "100";
  const h = heightMatch?.[1] ?? "100";
  return { viewBox: `0 0 ${w} ${h}`, inner };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/server/label/recolor-svg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/label/recolor-svg.ts tests/server/label/recolor-svg.test.ts
git commit -m "feat: recolorSvg helper"
```

---

### Task B4: Label types

**Files:**
- Create: `src/server/label/types.ts`

- [ ] **Step 1: Create `src/server/label/types.ts`**

```ts
import { z } from "zod";

export const labelConfigSchema = z.object({
  name: z.string().default(""),
  size: z.string().default(""),
  price: z.string().default(""),
  footerLine1: z.string().default(""),
  footerLine2: z.string().default(""),
  logoId: z.string().nullable().default(null),
  colors: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"),
    foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  }).default({ background: "#000000", foreground: "#ffffff" }),
});

export type LabelConfig = z.infer<typeof labelConfigSchema>;

export interface LoadedLogo {
  id: string;
  mimeType: string;
  recolorable: boolean;
  bytes: Buffer;       // raw file bytes
  text: string | null; // SVG content as string when recolorable, else null
}

export const DEFAULT_CONFIG: LabelConfig = labelConfigSchema.parse({});
```

- [ ] **Step 2: Commit**

```bash
git add src/server/label/types.ts
git commit -m "feat: LabelConfig schema + LoadedLogo type"
```

---

### Task B5: renderLabelSvg

**Files:**
- Create: `src/server/label/render.ts`
- Create: `tests/server/label/render.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/server/label/render.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { renderLabelSvg } from "~/server/label/render";
import type { LabelConfig, LoadedLogo } from "~/server/label/types";

const baseConfig: LabelConfig = {
  name: "fritz-kola",
  size: "0,33 L",
  price: "2,00 €",
  footerLine1: "Koffein: 25 mg/100 ml",
  footerLine2: "Zucker: 9,9 g/100 ml",
  logoId: null,
  colors: { background: "#000000", foreground: "#ffffff" },
};

describe("renderLabelSvg", () => {
  test("emits an SVG with the right canvas size", () => {
    const svg = renderLabelSvg(baseConfig, null);
    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 630 800"/);
    expect(svg).toMatch(/<rect[^>]*fill="#000000"/);
  });

  test("emits text slots with foreground color", () => {
    const svg = renderLabelSvg(baseConfig, null);
    expect(svg).toContain("fritz-kola");
    expect(svg).toContain("0,33 L");
    expect(svg).toContain("2,00 €");
    expect(svg).toMatch(/fill="#ffffff"/);
  });

  test("escapes XML-special characters in text", () => {
    const svg = renderLabelSvg(
      { ...baseConfig, name: "A & B <c>" },
      null,
    );
    expect(svg).toContain("A &amp; B &lt;c&gt;");
    expect(svg).not.toContain("A & B <c>");
  });

  test("omits logo block when no logo provided", () => {
    const svg = renderLabelSvg({ ...baseConfig, logoId: null }, null);
    expect(svg).not.toContain("<image");
    expect(svg).not.toMatch(/<g [^>]*data-logo/);
  });

  test("inlines and recolors an SVG logo when recolorable", () => {
    const logo: LoadedLogo = {
      id: "abc",
      mimeType: "image/svg+xml",
      recolorable: true,
      bytes: Buffer.from(""),
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="black" /></svg>',
    };
    const svg = renderLabelSvg(
      { ...baseConfig, logoId: "abc", colors: { background: "#000", foreground: "#abcdef" } },
      logo,
    );
    expect(svg).toContain('fill="#abcdef"');
    expect(svg).not.toContain('fill="black"');
  });

  test("embeds a PNG logo as a data URI", () => {
    const logo: LoadedLogo = {
      id: "png",
      mimeType: "image/png",
      recolorable: false,
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      text: null,
    };
    const svg = renderLabelSvg({ ...baseConfig, logoId: "png" }, logo);
    expect(svg).toMatch(/<image [^>]*href="data:image\/png;base64,/);
  });

  test("auto-shrinks long text", () => {
    const longName = "an extremely long product name that does not fit at all";
    const svg = renderLabelSvg({ ...baseConfig, name: longName }, null);
    const fontSizeMatch = svg.match(new RegExp(`<text[^>]*font-size="(\\d+)"[^>]*>[^<]*<tspan[^>]*>${longName}`));
    expect(fontSizeMatch).not.toBeNull();
    expect(Number(fontSizeMatch![1])).toBeLessThan(96);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/server/label/render.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/label/render.ts`**

```ts
import { CANVAS, SLOTS, type SlotKey } from "./slots";
import { fitFontSize } from "./fit-font";
import { extractSvgInner, recolorSvg } from "./recolor-svg";
import type { LabelConfig, LoadedLogo } from "./types";

const TEXT_SLOTS: Array<{ key: Exclude<SlotKey, "logo">; field: keyof Pick<LabelConfig, "name" | "size" | "price" | "footerLine1" | "footerLine2"> }> = [
  { key: "name",        field: "name" },
  { key: "size",        field: "size" },
  { key: "price",       field: "price" },
  { key: "footerLine1", field: "footerLine1" },
  { key: "footerLine2", field: "footerLine2" },
];

const MIN_FONT = 24;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderTextSlot(text: string, slot: typeof SLOTS[Exclude<SlotKey, "logo">], color: string): string {
  if (!text) return "";
  const fontSize = fitFontSize(text, slot.width, slot.defaultFontSize, MIN_FONT);
  const safe = escapeXml(text);
  // textLength + lengthAdjust is a safety net so the rasterizer never overflows even if our
  // glyph width approximation is slightly off.
  return `<text font-family="Inter" font-size="${fontSize}" fill="${color}" textLength="${slot.width}" lengthAdjust="spacingAndGlyphs"><tspan x="${slot.x}" y="${slot.y}" textLength="${slot.width}" lengthAdjust="spacingAndGlyphs">${safe}</tspan></text>`;
}

function renderLogo(logo: LoadedLogo | null, foreground: string): string {
  if (!logo) return "";
  const slot = SLOTS.logo;
  if (logo.recolorable && logo.text) {
    const recolored = recolorSvg(logo.text, foreground);
    const { viewBox, inner } = extractSvgInner(recolored);
    return `<svg x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  }
  const base64 = logo.bytes.toString("base64");
  return `<image x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" preserveAspectRatio="xMidYMid meet" href="data:${logo.mimeType};base64,${base64}" />`;
}

export function renderLabelSvg(config: LabelConfig, logo: LoadedLogo | null): string {
  const bg = config.colors.background;
  const fg = config.colors.foreground;
  const textParts = TEXT_SLOTS.map(({ key, field }) =>
    renderTextSlot(config[field], SLOTS[key], fg),
  ).join("");
  const logoPart = renderLogo(logo, fg);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${bg}"/>`,
    logoPart,
    textParts,
    `</svg>`,
  ].join("");
}

export function rotateSvg(svg: string, rotate: 0 | 90): string {
  if (rotate === 0) return svg;
  // Wrap the existing canvas in a 90° rotation. New viewBox is height x width.
  return svg
    .replace(
      /<svg([^>]*)>/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.height}" height="${CANVAS.width}" viewBox="0 0 ${CANVAS.height} ${CANVAS.width}"><g transform="rotate(90 0 0) translate(0 -${CANVAS.height})">`,
    )
    .replace(/<\/svg>$/, "</g></svg>");
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/server/label/render.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Add a rotate test**

Append to `tests/server/label/render.test.ts`:

```ts
import { rotateSvg } from "~/server/label/render";

describe("rotateSvg", () => {
  test("returns input unchanged when rotate=0", () => {
    const svg = renderLabelSvg(baseConfig, null);
    expect(rotateSvg(svg, 0)).toBe(svg);
  });

  test("wraps SVG in a rotation group when rotate=90", () => {
    const svg = renderLabelSvg(baseConfig, null);
    const rotated = rotateSvg(svg, 90);
    expect(rotated).toMatch(/viewBox="0 0 800 630"/);
    expect(rotated).toContain("transform=\"rotate(90 0 0) translate(0 -800)\"");
  });
});
```

Run: `npm test -- tests/server/label/render.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/label/render.ts tests/server/label/render.test.ts
git commit -m "feat: renderLabelSvg + rotation"
```

---

### Task B6: Logo storage helpers

**Files:**
- Create: `src/server/logos/storage.ts`
- Create: `src/server/logos/detect-recolorable.ts`
- Create: `tests/server/logos/storage.test.ts`
- Create: `tests/server/logos/detect-recolorable.test.ts`

- [ ] **Step 1: Write failing test for `detectRecolorable`**

Create `tests/server/logos/detect-recolorable.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { detectRecolorable, mimeFromExtension } from "~/server/logos/detect-recolorable";

describe("detectRecolorable", () => {
  test("svg is recolorable", () => {
    expect(detectRecolorable("image/svg+xml")).toBe(true);
  });
  test("png is not recolorable", () => {
    expect(detectRecolorable("image/png")).toBe(false);
  });
  test("jpeg is not recolorable", () => {
    expect(detectRecolorable("image/jpeg")).toBe(false);
  });
});

describe("mimeFromExtension", () => {
  test("returns supported types", () => {
    expect(mimeFromExtension("logo.svg")).toBe("image/svg+xml");
    expect(mimeFromExtension("logo.PNG")).toBe("image/png");
    expect(mimeFromExtension("logo.jpg")).toBe("image/jpeg");
    expect(mimeFromExtension("logo.jpeg")).toBe("image/jpeg");
  });
  test("returns null for unsupported", () => {
    expect(mimeFromExtension("logo.gif")).toBe(null);
    expect(mimeFromExtension("logo")).toBe(null);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/server/logos/detect-recolorable.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/logos/detect-recolorable.ts`**

```ts
const ALLOWED_MIMES = ["image/svg+xml", "image/png", "image/jpeg"] as const;
export type AllowedMime = (typeof ALLOWED_MIMES)[number];

export function detectRecolorable(mimeType: string): boolean {
  return mimeType === "image/svg+xml";
}

export function mimeFromExtension(filename: string): AllowedMime | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "svg": return "image/svg+xml";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    default: return null;
  }
}

export function extensionFromMime(mime: AllowedMime): string {
  switch (mime) {
    case "image/svg+xml": return "svg";
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
  }
}

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/server/logos/detect-recolorable.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for storage**

Create `tests/server/logos/storage.test.ts`:

```ts
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LogoStorage } from "~/server/logos/storage";

let tmpDir: string;
afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("LogoStorage", () => {
  test("writes a logo and reads it back", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "logos-test-"));
    const storage = new LogoStorage(tmpDir);
    const result = await storage.save({ id: "abc", extension: "svg", bytes: Buffer.from("<svg/>") });
    expect(result.relativePath).toMatch(/^abc\.svg$/);
    const buf = await storage.read("abc.svg");
    expect(buf.toString()).toBe("<svg/>");
  });

  test("delete removes the file", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "logos-test-"));
    const storage = new LogoStorage(tmpDir);
    await storage.save({ id: "x", extension: "png", bytes: Buffer.from("png") });
    await storage.delete("x.png");
    await expect(storage.read("x.png")).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run, verify fail**

Run: `npm test -- tests/server/logos/storage.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement `src/server/logos/storage.ts`**

```ts
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SaveLogoInput {
  id: string;
  extension: string;
  bytes: Buffer;
}

export class LogoStorage {
  constructor(private readonly rootDir: string) {}

  private async ensureDir() {
    await mkdir(this.rootDir, { recursive: true });
  }

  async save(input: SaveLogoInput): Promise<{ relativePath: string; absolutePath: string }> {
    await this.ensureDir();
    const relative = `${input.id}.${input.extension}`;
    const absolute = path.join(this.rootDir, relative);
    await writeFile(absolute, input.bytes);
    return { relativePath: relative, absolutePath: absolute };
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(path.join(this.rootDir, relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await unlink(path.join(this.rootDir, relativePath));
  }
}

let cachedStorage: LogoStorage | null = null;
export function getLogoStorage(): LogoStorage {
  if (cachedStorage) return cachedStorage;
  const root = process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, "logos")
    : "./data/uploads/logos";
  cachedStorage = new LogoStorage(root);
  return cachedStorage;
}
```

- [ ] **Step 8: Run, verify pass**

Run: `npm test -- tests/server/logos/storage.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/logos/ tests/server/logos/
git commit -m "feat: logo disk storage + mime detection"
```

---

### Task B7: Load logo helper

**Files:**
- Create: `src/server/logos/load.ts`
- Create: `tests/server/logos/load.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/server/logos/load.test.ts`:

```ts
import { afterEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, type TestDb } from "../../helpers/test-db";
import { logos } from "~/server/db/schema";
import { LogoStorage } from "~/server/logos/storage";
import { loadLogo } from "~/server/logos/load";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let testDb: TestDb;
let tmpDir: string;
let storage: LogoStorage;

afterEach(() => {
  testDb?.cleanup();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadLogo", () => {
  test("returns null for unknown id", async () => {
    testDb = setupTestDb();
    tmpDir = mkdtempSync(path.join(tmpdir(), "load-logo-"));
    storage = new LogoStorage(tmpDir);
    const result = await loadLogo(testDb.db, storage, "missing");
    expect(result).toBeNull();
  });

  test("returns LoadedLogo for SVG with text", async () => {
    testDb = setupTestDb();
    tmpDir = mkdtempSync(path.join(tmpdir(), "load-logo-"));
    storage = new LogoStorage(tmpDir);
    const svg = "<svg/>";
    await storage.save({ id: "s1", extension: "svg", bytes: Buffer.from(svg) });
    await testDb.db.insert(logos).values({
      id: "s1",
      filename: "logo.svg",
      storagePath: "s1.svg",
      mimeType: "image/svg+xml",
      recolorable: true,
      createdAt: Date.now(),
    });
    const result = await loadLogo(testDb.db, storage, "s1");
    expect(result).not.toBeNull();
    expect(result!.recolorable).toBe(true);
    expect(result!.text).toBe(svg);
  });

  test("returns LoadedLogo for PNG without text", async () => {
    testDb = setupTestDb();
    tmpDir = mkdtempSync(path.join(tmpdir(), "load-logo-"));
    storage = new LogoStorage(tmpDir);
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await storage.save({ id: "p1", extension: "png", bytes });
    await testDb.db.insert(logos).values({
      id: "p1",
      filename: "logo.png",
      storagePath: "p1.png",
      mimeType: "image/png",
      recolorable: false,
      createdAt: Date.now(),
    });
    const result = await loadLogo(testDb.db, storage, "p1");
    expect(result).not.toBeNull();
    expect(result!.recolorable).toBe(false);
    expect(result!.text).toBeNull();
    expect(result!.bytes).toEqual(bytes);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/server/logos/load.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/server/logos/load.ts`**

```ts
import { eq } from "drizzle-orm";
import type { Db } from "~/server/db/client";
import { logos } from "~/server/db/schema";
import type { LoadedLogo } from "~/server/label/types";
import type { LogoStorage } from "./storage";

export async function loadLogo(
  db: Db,
  storage: LogoStorage,
  logoId: string,
): Promise<LoadedLogo | null> {
  const rows = await db.select().from(logos).where(eq(logos.id, logoId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const bytes = await storage.read(row.storagePath);
  return {
    id: row.id,
    mimeType: row.mimeType,
    recolorable: row.recolorable,
    bytes,
    text: row.recolorable ? bytes.toString("utf8") : null,
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/server/logos/load.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/logos/load.ts tests/server/logos/load.test.ts
git commit -m "feat: loadLogo helper"
```

---

## Phase C — APIs

API tests use `node-mocks-http` to call handlers directly with mocked `req`/`res`. Each test sets up a fresh DB and points `process.env.DATABASE_PATH`/`UPLOADS_DIR` at a temp directory before requiring the handler. Helpers below.

### Task C1: API test harness

**Files:**
- Create: `tests/helpers/api.ts`

- [ ] **Step 1: Create `tests/helpers/api.ts`**

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface ApiTestEnv {
  databasePath: string;
  uploadsDir: string;
  rootDir: string;
  cleanup: () => void;
}

export function setupApiEnv(): ApiTestEnv {
  const root = mkdtempSync(path.join(tmpdir(), "matemat-api-"));
  const databasePath = path.join(root, "test.db");
  const uploadsDir = path.join(root, "uploads");
  const prev = {
    DATABASE_PATH: process.env.DATABASE_PATH,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
  };
  process.env.DATABASE_PATH = databasePath;
  process.env.UPLOADS_DIR = uploadsDir;
  return {
    databasePath,
    uploadsDir,
    rootDir: root,
    cleanup: () => {
      process.env.DATABASE_PATH = prev.DATABASE_PATH;
      process.env.UPLOADS_DIR = prev.UPLOADS_DIR;
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function loadFreshHandler<T>(modulePath: string): Promise<T> {
  // Vitest caches modules; this forces a re-import so the env vars above are picked up.
  const cacheBust = `?t=${Date.now()}-${Math.random()}`;
  const mod: { default: T } = await import(`${modulePath}${cacheBust}`);
  return mod.default;
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/api.ts
git commit -m "test: api harness"
```

---

### Task C2: Drafts CRUD API

**Files:**
- Create: `src/pages/api/drafts/index.ts`
- Create: `src/pages/api/drafts/[id].ts`
- Create: `tests/api/drafts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/drafts.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

describe("drafts API", () => {
  test("POST /api/drafts creates a draft and returns id", async () => {
    const handler = await importHandler("../../src/pages/api/drafts/index");
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  test("GET /api/drafts lists drafts", async () => {
    const indexHandler = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await indexHandler(post.req, post.res);
    const get = createMocks({ method: "GET" });
    await indexHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(200);
    const list = get.res._getJSONData();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
  });

  test("PUT /api/drafts/[id] updates config", async () => {
    const indexHandler = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await indexHandler(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/drafts/[id]");
    const put = createMocks({
      method: "PUT",
      query: { id },
      body: {
        name: "test",
        size: "0,33 L",
        price: "1,50 €",
        footerLine1: "",
        footerLine2: "",
        logoId: null,
        colors: { background: "#000000", foreground: "#ffffff" },
      },
    });
    await idHandler(put.req, put.res);
    expect(put.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(200);
    expect(get.res._getJSONData().name).toBe("test");
  });

  test("DELETE /api/drafts/[id] removes draft", async () => {
    const indexHandler = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await indexHandler(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/drafts/[id]");
    const del = createMocks({ method: "DELETE", query: { id } });
    await idHandler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(404);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/drafts.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/pages/api/drafts/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { getDb } from "~/server/db/client";
import { drafts } from "~/server/db/schema";
import { DEFAULT_CONFIG } from "~/server/label/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  if (req.method === "POST") {
    const id = nanoid(12);
    const now = Date.now();
    await db.insert(drafts).values({
      id,
      config: JSON.stringify(DEFAULT_CONFIG),
      updatedAt: now,
    });
    return res.status(200).json({ id });
  }
  if (req.method === "GET") {
    const rows = await db.select().from(drafts);
    const out = rows.map((row) => ({
      id: row.id,
      config: JSON.parse(row.config),
      updatedAt: row.updatedAt,
    }));
    return res.status(200).json(out);
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
```

- [ ] **Step 4: Implement `src/pages/api/drafts/[id].ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { drafts } from "~/server/db/schema";
import { labelConfigSchema } from "~/server/label/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });
  const db = getDb();

  if (req.method === "GET") {
    const row = (await db.select().from(drafts).where(eq(drafts.id, id)).limit(1))[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({
      id: row.id,
      config: JSON.parse(row.config),
      updatedAt: row.updatedAt,
    });
  }
  if (req.method === "PUT") {
    const parsed = labelConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_config" });
    const result = await db
      .update(drafts)
      .set({ config: JSON.stringify(parsed.data), updatedAt: Date.now() })
      .where(eq(drafts.id, id));
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE") {
    await db.delete(drafts).where(eq(drafts.id, id));
    return res.status(200).json({ ok: true });
  }
  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).end();
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- tests/api/drafts.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/drafts/ tests/api/drafts.test.ts
git commit -m "feat: drafts CRUD API"
```

---

### Task C3: Labels CRUD API + promote-from-draft

**Files:**
- Create: `src/pages/api/labels/index.ts`
- Create: `src/pages/api/labels/[id]/index.ts`
- Create: `tests/api/labels.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/labels.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

async function createDraft(): Promise<string> {
  const handler = await importHandler("../../src/pages/api/drafts/index");
  const { req, res } = createMocks({ method: "POST" });
  await handler(req, res);
  return res._getJSONData().id;
}

describe("labels API", () => {
  test("POST /api/labels promotes a draft", async () => {
    const draftId = await createDraft();
    const handler = await importHandler("../../src/pages/api/labels/index");
    const { req, res } = createMocks({
      method: "POST",
      body: { draftId, name: "Fritz-Kola 0,33L" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(typeof body.id).toBe("string");

    // draft is gone
    const getDraft = await importHandler("../../src/pages/api/drafts/[id]");
    const draftReq = createMocks({ method: "GET", query: { id: draftId } });
    await getDraft(draftReq.req, draftReq.res);
    expect(draftReq.res._getStatusCode()).toBe(404);

    // label exists
    const list = createMocks({ method: "GET" });
    await handler(list.req, list.res);
    expect(list.res._getJSONData()).toHaveLength(1);
  });

  test("PUT /api/labels/[id] updates config", async () => {
    const draftId = await createDraft();
    const promote = await importHandler("../../src/pages/api/labels/index");
    const post = createMocks({ method: "POST", body: { draftId, name: "L" } });
    await promote(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/labels/[id]/index");
    const put = createMocks({
      method: "PUT",
      query: { id },
      body: {
        name: "Renamed",
        config: {
          name: "x", size: "", price: "", footerLine1: "", footerLine2: "",
          logoId: null, colors: { background: "#111111", foreground: "#eeeeee" },
        },
      },
    });
    await idHandler(put.req, put.res);
    expect(put.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getJSONData().name).toBe("Renamed");
    expect(get.res._getJSONData().config.colors.background).toBe("#111111");
  });

  test("DELETE /api/labels/[id] removes label", async () => {
    const draftId = await createDraft();
    const promote = await importHandler("../../src/pages/api/labels/index");
    const post = createMocks({ method: "POST", body: { draftId, name: "L" } });
    await promote(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/labels/[id]/index");
    const del = createMocks({ method: "DELETE", query: { id } });
    await idHandler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(404);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/labels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/api/labels/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "~/server/db/client";
import { drafts, labels } from "~/server/db/schema";
import { z } from "zod";

const promoteSchema = z.object({
  draftId: z.string().min(1),
  name: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  if (req.method === "POST") {
    const parsed = promoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_input" });
    const { draftId, name } = parsed.data;

    const draft = (await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
    if (!draft) return res.status(404).json({ error: "draft_not_found" });

    const id = nanoid(12);
    const now = Date.now();
    await db.transaction(async (tx) => {
      await tx.insert(labels).values({
        id,
        name,
        config: draft.config,
        createdAt: now,
        updatedAt: now,
      });
      await tx.delete(drafts).where(eq(drafts.id, draftId));
    });
    return res.status(200).json({ id });
  }

  if (req.method === "GET") {
    const rows = await db.select().from(labels);
    return res.status(200).json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        config: JSON.parse(row.config),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
```

- [ ] **Step 4: Implement `src/pages/api/labels/[id]/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { labelConfigSchema } from "~/server/label/types";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  config: labelConfigSchema.optional(),
}).refine((v) => v.name !== undefined || v.config !== undefined, {
  message: "must update name or config",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });
  const db = getDb();

  if (req.method === "GET") {
    const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({
      id: row.id,
      name: row.name,
      config: JSON.parse(row.config),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_input" });
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.config !== undefined) update.config = JSON.stringify(parsed.data.config);
    const result = await db.update(labels).set(update).where(eq(labels.id, id));
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE") {
    await db.delete(labels).where(eq(labels.id, id));
    return res.status(200).json({ ok: true });
  }
  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).end();
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- tests/api/labels.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/labels/index.ts src/pages/api/labels/[id]/index.ts tests/api/labels.test.ts
git commit -m "feat: labels CRUD + promote API"
```

---

### Task C4: Logo upload + list APIs

**Files:**
- Create: `src/pages/api/logos/index.ts`
- Create: `tests/api/logos-upload.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/logos-upload.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

// formidable expects a real readable stream; we'll fake by pointing it at a temp file.
function multipartReq(filename: string, contentType: string, contents: Buffer) {
  const boundary = "----test";
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head), contents, Buffer.from(tail)]);
  const { req, res } = createMocks({
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
  });
  req.push(body);
  req.push(null);
  return { req, res };
}

describe("POST /api/logos", () => {
  test("uploads an SVG and marks it recolorable", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="black" /></svg>');
    const { req, res } = multipartReq("logo.svg", "image/svg+xml", svg);
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(body.recolorable).toBe(true);
    expect(body.mimeType).toBe("image/svg+xml");
    expect(body.filename).toBe("logo.svg");
  });

  test("rejects unsupported mime types", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const { req, res } = multipartReq("logo.gif", "image/gif", Buffer.from("GIF89a"));
    await handler(req, res);
    expect(res._getStatusCode()).toBe(415);
  });

  test("GET /api/logos lists uploaded logos", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const { req: postReq, res: postRes } = multipartReq("logo.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await handler(postReq, postRes);
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/logos-upload.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/api/logos/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";
import formidable from "formidable";
import { readFile } from "node:fs/promises";
import { getDb } from "~/server/db/client";
import { logos } from "~/server/db/schema";
import {
  detectRecolorable,
  extensionFromMime,
  isAllowedMime,
} from "~/server/logos/detect-recolorable";
import { getLogoStorage } from "~/server/logos/storage";

export const config = {
  api: { bodyParser: false },
};

const MAX_BYTES = 10 * 1024 * 1024;

async function parseForm(req: NextApiRequest) {
  const form = formidable({ maxFileSize: MAX_BYTES, multiples: false });
  return new Promise<{ file: formidable.File }>((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) return reject(err);
      const fileField = files.file;
      const file = Array.isArray(fileField) ? fileField[0] : fileField;
      if (!file) return reject(new Error("missing_file"));
      resolve({ file });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();

  if (req.method === "GET") {
    const rows = await db.select().from(logos);
    return res.status(200).json(rows);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }

  let file: formidable.File;
  try {
    ({ file } = await parseForm(req));
  } catch (err) {
    if (err instanceof Error && err.message.includes("maxFileSize")) {
      return res.status(413).json({ error: "too_large" });
    }
    return res.status(400).json({ error: "bad_upload" });
  }

  const mime = file.mimetype ?? "";
  if (!isAllowedMime(mime)) {
    return res.status(415).json({ error: "unsupported_format" });
  }

  const id = nanoid(12);
  const ext = extensionFromMime(mime);
  const bytes = await readFile(file.filepath);
  const storage = getLogoStorage();
  const { relativePath } = await storage.save({ id, extension: ext, bytes });

  const row = {
    id,
    filename: file.originalFilename ?? `logo.${ext}`,
    storagePath: relativePath,
    mimeType: mime,
    recolorable: detectRecolorable(mime),
    createdAt: Date.now(),
  };
  await db.insert(logos).values(row);
  return res.status(200).json(row);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/api/logos-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/logos/index.ts tests/api/logos-upload.test.ts
git commit -m "feat: logo upload + list API"
```

---

### Task C5: Logo file + rename + delete APIs

**Files:**
- Create: `src/pages/api/logos/[id]/index.ts`
- Create: `src/pages/api/logos/[id]/file.ts`
- Create: `tests/api/logos-id.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/logos-id.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";
import { eq } from "drizzle-orm";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

async function uploadOne(): Promise<string> {
  const handler = await importHandler("../../src/pages/api/logos/index");
  const boundary = "----test";
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.svg"\r\nContent-Type: image/svg+xml\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head), Buffer.from("<svg/>"), Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const { req, res } = createMocks({
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
  });
  req.push(body); req.push(null);
  await handler(req, res);
  return res._getJSONData().id;
}

describe("logo file + rename + delete", () => {
  test("GET /api/logos/[id]/file returns the bytes", async () => {
    const id = await uploadOne();
    const handler = await importHandler("../../src/pages/api/logos/[id]/file");
    const { req, res } = createMocks({ method: "GET", query: { id } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toBe("image/svg+xml");
    expect(res._getData()).toBe("<svg/>");
  });

  test("PUT /api/logos/[id] renames", async () => {
    const id = await uploadOne();
    const handler = await importHandler("../../src/pages/api/logos/[id]/index");
    const put = createMocks({ method: "PUT", query: { id }, body: { filename: "renamed.svg" } });
    await handler(put.req, put.res);
    expect(put.res._getStatusCode()).toBe(200);

    const list = await importHandler("../../src/pages/api/logos/index");
    const get = createMocks({ method: "GET" });
    await list(get.req, get.res);
    expect(get.res._getJSONData()[0].filename).toBe("renamed.svg");
  });

  test("DELETE refuses if logo is used by a label", async () => {
    const id = await uploadOne();

    // Build a draft + label using this logo.
    const drafts = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await drafts(post.req, post.res);
    const draftId = post.res._getJSONData().id;
    const draftId2 = await importHandler("../../src/pages/api/drafts/[id]");
    const put = createMocks({
      method: "PUT",
      query: { id: draftId },
      body: {
        name: "x", size: "", price: "", footerLine1: "", footerLine2: "",
        logoId: id, colors: { background: "#000000", foreground: "#ffffff" },
      },
    });
    await draftId2(put.req, put.res);

    const promote = await importHandler("../../src/pages/api/labels/index");
    const promoteReq = createMocks({ method: "POST", body: { draftId, name: "x" } });
    await promote(promoteReq.req, promoteReq.res);

    const handler = await importHandler("../../src/pages/api/logos/[id]/index");
    const del = createMocks({ method: "DELETE", query: { id } });
    await handler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(409);
  });

  test("DELETE with ?force=true clears logoId on labels and removes logo", async () => {
    const id = await uploadOne();

    const drafts = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await drafts(post.req, post.res);
    const draftId = post.res._getJSONData().id;
    const draftId2 = await importHandler("../../src/pages/api/drafts/[id]");
    const put = createMocks({
      method: "PUT",
      query: { id: draftId },
      body: {
        name: "x", size: "", price: "", footerLine1: "", footerLine2: "",
        logoId: id, colors: { background: "#000000", foreground: "#ffffff" },
      },
    });
    await draftId2(put.req, put.res);
    const promote = await importHandler("../../src/pages/api/labels/index");
    const promoteReq = createMocks({ method: "POST", body: { draftId, name: "x" } });
    await promote(promoteReq.req, promoteReq.res);
    const labelId = promoteReq.res._getJSONData().id;

    const handler = await importHandler("../../src/pages/api/logos/[id]/index");
    const del = createMocks({ method: "DELETE", query: { id, force: "true" } });
    await handler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(200);

    const labelById = await importHandler("../../src/pages/api/labels/[id]/index");
    const get = createMocks({ method: "GET", query: { id: labelId } });
    await labelById(get.req, get.res);
    expect(get.res._getJSONData().config.logoId).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/logos-id.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/api/logos/[id]/file.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { logos } from "~/server/db/schema";
import { getLogoStorage } from "~/server/logos/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const db = getDb();
  const row = (await db.select().from(logos).where(eq(logos.id, id)).limit(1))[0];
  if (!row) return res.status(404).end();
  const bytes = await getLogoStorage().read(row.storagePath);
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("Cache-Control", "private, max-age=86400");
  return res.status(200).send(bytes);
}
```

- [ ] **Step 4: Implement `src/pages/api/logos/[id]/index.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/server/db/client";
import { drafts, labels, logos } from "~/server/db/schema";
import { getLogoStorage } from "~/server/logos/storage";

const renameSchema = z.object({ filename: z.string().min(1).max(200) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });
  const db = getDb();

  if (req.method === "PUT") {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_input" });
    const result = await db
      .update(logos)
      .set({ filename: parsed.data.filename })
      .where(eq(logos.id, id));
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const row = (await db.select().from(logos).where(eq(logos.id, id)).limit(1))[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    const force = req.query.force === "true";

    // We use JSON_EXTRACT for portability. Drizzle's sql tag works fine here.
    const usingLabels = await db
      .select({ id: labels.id })
      .from(labels)
      .where(sql`json_extract(${labels.config}, '$.logoId') = ${id}`);
    const usingDrafts = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(sql`json_extract(${drafts.config}, '$.logoId') = ${id}`);

    if ((usingLabels.length || usingDrafts.length) && !force) {
      return res.status(409).json({
        error: "in_use",
        labelCount: usingLabels.length,
        draftCount: usingDrafts.length,
      });
    }

    await db.transaction(async (tx) => {
      if (force) {
        for (const l of usingLabels) {
          const cfg = (await tx.select().from(labels).where(eq(labels.id, l.id)).limit(1))[0];
          if (!cfg) continue;
          const parsed = JSON.parse(cfg.config);
          parsed.logoId = null;
          await tx.update(labels)
            .set({ config: JSON.stringify(parsed), updatedAt: Date.now() })
            .where(eq(labels.id, l.id));
        }
        for (const d of usingDrafts) {
          const cfg = (await tx.select().from(drafts).where(eq(drafts.id, d.id)).limit(1))[0];
          if (!cfg) continue;
          const parsed = JSON.parse(cfg.config);
          parsed.logoId = null;
          await tx.update(drafts)
            .set({ config: JSON.stringify(parsed), updatedAt: Date.now() })
            .where(eq(drafts.id, d.id));
        }
      }
      await tx.delete(logos).where(eq(logos.id, id));
    });

    try {
      await getLogoStorage().delete(row.storagePath);
    } catch {
      // file already missing; not fatal.
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).end();
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- tests/api/logos-id.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/logos/\[id\]/ tests/api/logos-id.test.ts
git commit -m "feat: logo file + rename + force-delete API"
```

---

### Task C6: SVG endpoint

**Files:**
- Create: `src/pages/api/labels/[id]/svg.ts`
- Create: `tests/api/svg.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/svg.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

async function makeDraft() {
  const idx = await importHandler("../../src/pages/api/drafts/index");
  const post = createMocks({ method: "POST" });
  await idx(post.req, post.res);
  const id = post.res._getJSONData().id;
  const byId = await importHandler("../../src/pages/api/drafts/[id]");
  const put = createMocks({
    method: "PUT", query: { id },
    body: {
      name: "fritz-kola", size: "0,33 L", price: "2,00 €",
      footerLine1: "Koffein: 25 mg/100 ml", footerLine2: "",
      logoId: null, colors: { background: "#000000", foreground: "#ffffff" },
    },
  });
  await byId(put.req, put.res);
  return id;
}

describe("GET /api/labels/[id]/svg", () => {
  test("returns SVG for a draft", async () => {
    const draftId = await makeDraft();
    const handler = await importHandler("../../src/pages/api/labels/[id]/svg");
    const { req, res } = createMocks({ method: "GET", query: { id: draftId, kind: "draft" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toContain("image/svg+xml");
    expect(res._getData()).toContain("fritz-kola");
  });

  test("rotate=90 returns landscape viewBox", async () => {
    const draftId = await makeDraft();
    const handler = await importHandler("../../src/pages/api/labels/[id]/svg");
    const { req, res } = createMocks({
      method: "GET", query: { id: draftId, kind: "draft", rotate: "90" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toContain('viewBox="0 0 800 630"');
  });

  test("404 for unknown id", async () => {
    const handler = await importHandler("../../src/pages/api/labels/[id]/svg");
    const { req, res } = createMocks({ method: "GET", query: { id: "nope", kind: "draft" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/svg.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/api/labels/[id]/svg.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { drafts, labels } from "~/server/db/schema";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import { labelConfigSchema } from "~/server/label/types";
import { loadLogo } from "~/server/logos/load";
import { getLogoStorage } from "~/server/logos/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  const kind = req.query.kind;
  const rotateRaw = req.query.rotate;
  if (typeof id !== "string" || (kind !== "draft" && kind !== "saved")) {
    return res.status(400).json({ error: "bad_query" });
  }
  const rotate: 0 | 90 = rotateRaw === "90" ? 90 : 0;
  const db = getDb();
  const row =
    kind === "draft"
      ? (await db.select().from(drafts).where(eq(drafts.id, id)).limit(1))[0]
      : (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const config = labelConfigSchema.parse(JSON.parse(row.config));
  const logo = config.logoId ? await loadLogo(db, getLogoStorage(), config.logoId) : null;
  let svg = renderLabelSvg(config, logo);
  svg = rotateSvg(svg, rotate);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(svg);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/api/svg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/labels/\[id\]/svg.ts tests/api/svg.test.ts
git commit -m "feat: label SVG endpoint"
```

---

### Task C7: Repurpose `/api/matemat-label`

**Files:**
- Modify: `src/pages/api/matemat-label/generate-label.ts`
- Modify: `src/pages/api/matemat-label/index.ts`
- Create: `tests/api/matemat-label.test.ts` (lightweight — mocks the og-image-generator HTTP call)

- [ ] **Step 1: Update `generate-label.ts` to take a full URL (not template name)**

Replace contents:

```ts
export interface GeneratorConnection {
  endpoint: string;
  username: string;
  password: string;
}

export async function generateLabelPng(
  svgUrl: string,
  generatorConnection: GeneratorConnection,
): Promise<Blob> {
  const params = new URLSearchParams({ svgUrl });
  const fullURL = `${generatorConnection.endpoint}?${params.toString()}`;
  const auth = `Basic ${Buffer.from(`${generatorConnection.username}:${generatorConnection.password}`).toString("base64")}`;
  const response = await fetch(fullURL, {
    method: "GET",
    headers: { Authorization: auth },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`og-image-generator ${response.status}: ${text}`);
  }
  return response.blob();
}
```

- [ ] **Step 2: Update `index.ts` to be id-based**

Replace contents:

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { generateLabelPng } from "./generate-label";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  const kind = req.query.kind;
  const rotate = req.query.rotate;
  if (typeof id !== "string" || (kind !== "draft" && kind !== "saved")) {
    return res.status(400).json({ error: "bad_query" });
  }
  const endpoint = process.env.GENERATOR_URL;
  const username = process.env.GENERATOR_USER;
  const password = process.env.GENERATOR_PASS;
  const baseURL = process.env.INTERNAL_BASE_URL;
  if (!endpoint || !username || !password || !baseURL) {
    return res.status(500).json({ error: "generator_not_configured" });
  }
  const svgParams = new URLSearchParams({ id, kind });
  if (rotate === "90") svgParams.set("rotate", "90");
  const svgURL = `${baseURL}/api/labels/${encodeURIComponent(id)}/svg?${svgParams.toString()}`;
  try {
    const blob = await generateLabelPng(svgURL, { endpoint, username, password });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(await blob.arrayBuffer()));
  } catch (err) {
    return res.status(502).json({ error: "generator_failed", detail: String(err) });
  }
}
```

- [ ] **Step 3: Write a unit test that mocks `fetch`**

Create `tests/api/matemat-label.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => {
  env = setupApiEnv();
  process.env.GENERATOR_URL = "http://gen.example/og";
  process.env.GENERATOR_USER = "u";
  process.env.GENERATOR_PASS = "p";
  process.env.INTERNAL_BASE_URL = "http://app.example";
});
afterEach(() => {
  env.cleanup();
  vi.restoreAllMocks();
});

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

describe("GET /api/matemat-label", () => {
  test("forwards SVG URL to og-image-generator and returns PNG", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const handler = await importHandler("../../src/pages/api/matemat-label/index");
    const { req, res } = createMocks({
      method: "GET", query: { id: "abc", kind: "draft", rotate: "90" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toBe("image/png");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain("svgUrl=");
    expect(callUrl).toContain(encodeURIComponent("http://app.example/api/labels/abc/svg"));
    expect(callUrl).toContain(encodeURIComponent("rotate=90"));
  });

  test("returns 502 if generator fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const handler = await importHandler("../../src/pages/api/matemat-label/index");
    const { req, res } = createMocks({ method: "GET", query: { id: "abc", kind: "draft" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(502);
  });
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/api/matemat-label.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/matemat-label/ tests/api/matemat-label.test.ts
git commit -m "refactor: matemat-label endpoint becomes id-based"
```

---

### Task C8: Download endpoints (PNG + SVG single)

**Files:**
- Create: `src/pages/api/labels/[id]/download.png.ts`
- Create: `src/pages/api/labels/[id]/download.svg.ts`
- Create: `tests/api/download.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/download.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => {
  env = setupApiEnv();
  process.env.GENERATOR_URL = "http://gen.example/og";
  process.env.GENERATOR_USER = "u";
  process.env.GENERATOR_PASS = "p";
  process.env.INTERNAL_BASE_URL = "http://app.example";
});
afterEach(() => { env.cleanup(); vi.restoreAllMocks(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

async function makeLabel(name = "Test") {
  const drafts = await importHandler("../../src/pages/api/drafts/index");
  const post = createMocks({ method: "POST" });
  await drafts(post.req, post.res);
  const draftId = post.res._getJSONData().id;
  const promote = await importHandler("../../src/pages/api/labels/index");
  const promoted = createMocks({ method: "POST", body: { draftId, name } });
  await promote(promoted.req, promoted.res);
  return promoted.res._getJSONData().id;
}

describe("download.svg", () => {
  test("returns SVG with attachment disposition", async () => {
    const id = await makeLabel("Fritz");
    const handler = await importHandler("../../src/pages/api/labels/[id]/download.svg");
    const { req, res } = createMocks({ method: "GET", query: { id } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toContain("image/svg+xml");
    expect(String(res.getHeader("content-disposition"))).toContain("Fritz");
    expect(String(res.getHeader("content-disposition"))).toContain(".svg");
  });
});

describe("download.png", () => {
  test("forwards to og-image-generator with scale", async () => {
    const id = await makeLabel("Bionade");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
    );
    const handler = await importHandler("../../src/pages/api/labels/[id]/download.png");
    const { req, res } = createMocks({ method: "GET", query: { id, scale: "2" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toBe("image/png");
    expect(String(res.getHeader("content-disposition"))).toContain("Bionade");
    expect(fetchSpy.mock.calls[0][0] as string).toMatch(/scale=2|width=1260|height=1600/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/download.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/api/labels/[id]/download.svg.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import { labelConfigSchema } from "~/server/label/types";
import { loadLogo } from "~/server/logos/load";
import { getLogoStorage } from "~/server/logos/storage";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "label";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).end();
  const rotate: 0 | 90 = req.query.rotate === "90" ? 90 : 0;

  const db = getDb();
  const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const config = labelConfigSchema.parse(JSON.parse(row.config));
  const logo = config.logoId ? await loadLogo(db, getLogoStorage(), config.logoId) : null;
  const svg = rotateSvg(renderLabelSvg(config, logo), rotate);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(row.name)}.svg"`);
  return res.status(200).send(svg);
}
```

- [ ] **Step 4: Implement `src/pages/api/labels/[id]/download.png.ts`**

The og-image-generator's API supports scale/width/height query params (per its README — see `og-image-generator` repo). We pass `width` and `height` derived from CANVAS dimensions × scale, so the generator emits the right-size PNG.

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { CANVAS } from "~/server/label/slots";
import { generateLabelPng } from "../../matemat-label/generate-label";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "label";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).end();
  const scale = Number(req.query.scale ?? "1");
  if (![1, 2, 4].includes(scale)) return res.status(400).json({ error: "bad_scale" });
  const rotate: 0 | 90 = req.query.rotate === "90" ? 90 : 0;

  const db = getDb();
  const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const endpoint = process.env.GENERATOR_URL!;
  const user = process.env.GENERATOR_USER!;
  const pass = process.env.GENERATOR_PASS!;
  const base = process.env.INTERNAL_BASE_URL!;

  const svgParams = new URLSearchParams({ id, kind: "saved" });
  if (rotate === 90) svgParams.set("rotate", "90");
  const svgURL = `${base}/api/labels/${encodeURIComponent(id)}/svg?${svgParams.toString()}`;
  const w = (rotate === 90 ? CANVAS.height : CANVAS.width) * scale;
  const h = (rotate === 90 ? CANVAS.width : CANVAS.height) * scale;
  const fullURL = `${endpoint}?svgUrl=${encodeURIComponent(svgURL)}&width=${w}&height=${h}&scale=${scale}`;

  try {
    const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
    const resp = await fetch(fullURL, { headers: { Authorization: auth } });
    if (!resp.ok) {
      return res.status(502).json({ error: "generator_failed", detail: await resp.text() });
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename(row.name)}@${scale}x.png"`,
    );
    return res.status(200).send(Buffer.from(await resp.arrayBuffer()));
  } catch (err) {
    return res.status(502).json({ error: "generator_failed", detail: String(err) });
  }
}
```

(`generateLabelPng` from C7 is also imported above for type purity, but we call `fetch` directly here so we can pass the size hints.)

- [ ] **Step 5: Run, verify pass**

Run: `npm test -- tests/api/download.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/labels/\[id\]/download.png.ts src/pages/api/labels/\[id\]/download.svg.ts tests/api/download.test.ts
git commit -m "feat: single-label PNG + SVG download"
```

---

### Task C9: Batch download (zip)

**Files:**
- Create: `src/pages/api/labels/batch-download.ts`
- Create: `tests/api/batch-download.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/batch-download.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMocks } from "node-mocks-http";
import JSZip from "jszip";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => {
  env = setupApiEnv();
  process.env.GENERATOR_URL = "http://gen.example/og";
  process.env.GENERATOR_USER = "u";
  process.env.GENERATOR_PASS = "p";
  process.env.INTERNAL_BASE_URL = "http://app.example";
});
afterEach(() => { env.cleanup(); vi.restoreAllMocks(); });

async function importHandler(modulePath: string) {
  const mod = await import(`${modulePath}?cb=${Date.now()}-${Math.random()}`);
  return mod.default;
}

async function makeLabel(name: string) {
  const drafts = await importHandler("../../src/pages/api/drafts/index");
  const post = createMocks({ method: "POST" });
  await drafts(post.req, post.res);
  const draftId = post.res._getJSONData().id;
  const promote = await importHandler("../../src/pages/api/labels/index");
  const promoted = createMocks({ method: "POST", body: { draftId, name } });
  await promote(promoted.req, promoted.res);
  return promoted.res._getJSONData().id;
}

describe("batch-download", () => {
  test("returns a zip with svg files", async () => {
    const a = await makeLabel("Coke");
    const b = await makeLabel("Bionade");
    const handler = await importHandler("../../src/pages/api/labels/batch-download");
    const { req, res } = createMocks({
      method: "GET", query: { ids: `${a},${b}`, format: "svg" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toContain("application/zip");
    const buf = res._getData() as Buffer;
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.includes("Coke"))).toBe(true);
    expect(names.some((n) => n.includes("Bionade"))).toBe(true);
  });

  test("returns 404 when no ids resolve", async () => {
    const handler = await importHandler("../../src/pages/api/labels/batch-download");
    const { req, res } = createMocks({
      method: "GET", query: { ids: "no1,no2", format: "svg" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/api/batch-download.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/pages/api/labels/batch-download.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { eq, inArray } from "drizzle-orm";
import JSZip from "jszip";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { CANVAS } from "~/server/label/slots";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import { labelConfigSchema } from "~/server/label/types";
import { loadLogo } from "~/server/logos/load";
import { getLogoStorage } from "~/server/logos/storage";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "label";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const idsParam = req.query.ids;
  const format = req.query.format === "png" ? "png" : "svg";
  const scale = Number(req.query.scale ?? "1");
  if (![1, 2, 4].includes(scale)) return res.status(400).json({ error: "bad_scale" });
  const rotate: 0 | 90 = req.query.rotate === "90" ? 90 : 0;
  if (typeof idsParam !== "string" || idsParam.length === 0) {
    return res.status(400).json({ error: "missing_ids" });
  }
  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: "missing_ids" });

  const db = getDb();
  const rows = await db.select().from(labels).where(inArray(labels.id, ids));
  if (rows.length === 0) return res.status(404).json({ error: "no_labels" });

  const zip = new JSZip();
  const storage = getLogoStorage();

  if (format === "svg") {
    for (const row of rows) {
      const config = labelConfigSchema.parse(JSON.parse(row.config));
      const logo = config.logoId ? await loadLogo(db, storage, config.logoId) : null;
      const svg = rotateSvg(renderLabelSvg(config, logo), rotate);
      zip.file(`${safeFilename(row.name)}.svg`, svg);
    }
  } else {
    const endpoint = process.env.GENERATOR_URL!;
    const user = process.env.GENERATOR_USER!;
    const pass = process.env.GENERATOR_PASS!;
    const base = process.env.INTERNAL_BASE_URL!;
    const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

    for (const row of rows) {
      const svgParams = new URLSearchParams({ id: row.id, kind: "saved" });
      if (rotate === 90) svgParams.set("rotate", "90");
      const svgURL = `${base}/api/labels/${encodeURIComponent(row.id)}/svg?${svgParams.toString()}`;
      const w = (rotate === 90 ? CANVAS.height : CANVAS.width) * scale;
      const h = (rotate === 90 ? CANVAS.width : CANVAS.height) * scale;
      const fullURL = `${endpoint}?svgUrl=${encodeURIComponent(svgURL)}&width=${w}&height=${h}&scale=${scale}`;
      const resp = await fetch(fullURL, { headers: { Authorization: auth } });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      zip.file(`${safeFilename(row.name)}@${scale}x.png`, buf);
    }
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="labels.zip"`);
  return res.status(200).send(out);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- tests/api/batch-download.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/labels/batch-download.ts tests/api/batch-download.test.ts
git commit -m "feat: batch label download as zip"
```

---

## Phase D — UI primitives + theme

### Task D1: Theme + Inter font

**Files:**
- Modify: `src/pages/_app.tsx`
- Modify: `src/styles/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Update `src/pages/_app.tsx`**

```tsx
import { Inter } from "next/font/google";
import { type AppType } from "next/app";
import "~/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={`${inter.variable} font-sans min-h-screen bg-zinc-950 text-zinc-100`}>
      <Component {...pageProps} />
    </div>
  );
};

export default MyApp;
```

- [ ] **Step 2: Update `tailwind.config.ts`**

```ts
import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...fontFamily.sans],
      },
      colors: {
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Update `src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-zinc-950 text-zinc-100;
  }
  *:focus-visible {
    @apply outline-none ring-2 ring-accent ring-offset-2 ring-offset-zinc-950;
  }
}
```

- [ ] **Step 4: Remove unused Geist import**

The replacement above already does this; just verify `geist` isn't imported anywhere else with `grep -r "geist" src/`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/_app.tsx src/styles/globals.css tailwind.config.ts
git commit -m "feat: dark theme + Inter font"
```

---

### Task D2: Button + utility class helper

**Files:**
- Create: `src/_components/ui/cn.ts`
- Create: `src/_components/ui/button.tsx`

- [ ] **Step 1: Create `src/_components/ui/cn.ts`**

```ts
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: Create `src/_components/ui/button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent hover:bg-accent-hover text-white",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100",
  ghost: "bg-transparent hover:bg-zinc-800 text-zinc-100",
  danger: "bg-red-600 hover:bg-red-500 text-white",
};
const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add src/_components/ui/cn.ts src/_components/ui/button.tsx
git commit -m "feat: Button + cn helper"
```

---

### Task D3: Dialog + Popover wrappers

**Files:**
- Create: `src/_components/ui/dialog.tsx`
- Create: `src/_components/ui/popover.tsx`

- [ ] **Step 1: Create `src/_components/ui/dialog.tsx`**

```tsx
import * as RadixDialog from "@radix-ui/react-dialog";
import { type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-zinc-900 p-6 shadow-2xl",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-zinc-400">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close className="rounded-md p-1 hover:bg-zinc-800" aria-label="Close">
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
```

- [ ] **Step 2: Create `src/_components/ui/popover.tsx`**

```tsx
import * as RadixPopover from "@radix-ui/react-popover";
import { type ReactNode } from "react";
import { cn } from "./cn";

export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 rounded-xl bg-zinc-900 p-3 shadow-xl border border-zinc-800",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/_components/ui/dialog.tsx src/_components/ui/popover.tsx
git commit -m "feat: Dialog + Popover wrappers"
```

---

### Task D4: ColorPicker primitive

**Files:**
- Create: `src/_components/ui/color-picker.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/_components/ui/color-picker.tsx
git commit -m "feat: ColorPicker primitive"
```

---

### Task D5: Debounced save hook

**Files:**
- Create: `src/_hooks/use-debounced-save.ts`

- [ ] **Step 1: Create the file**

```ts
import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useDebouncedSave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  delay = 500,
): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    setState("idle");
    const timeout = setTimeout(() => {
      setState("saving");
      save(latest.current)
        .then(() => setState("saved"))
        .catch(() => setState("error"));
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay, save]);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/_hooks/use-debounced-save.ts
git commit -m "feat: useDebouncedSave hook"
```

---

## Phase E — UI pages

### Task E1: Editor preview component

**Files:**
- Create: `src/_components/editor/preview.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from "react";
import { Button } from "~/_components/ui/button";
import { cn } from "~/_components/ui/cn";

export function LabelPreview({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className="flex flex-1 items-center justify-center rounded-xl border border-zinc-800 p-4"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "shadow-2xl transition-all",
            zoom === "fit" ? "max-h-full max-w-full" : "max-w-none",
          )}
          style={zoom === "actual" ? { width: 630, height: 800 } : undefined}
        />
      </div>
      <div className="flex justify-center gap-2">
        <Button
          variant={zoom === "fit" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setZoom("fit")}
        >
          Fit
        </Button>
        <Button
          variant={zoom === "actual" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setZoom("actual")}
        >
          100%
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/_components/editor/preview.tsx
git commit -m "feat: editor preview component"
```

---

### Task E2: Editor sections (text, color, logo)

**Files:**
- Create: `src/_components/editor/text-section.tsx`
- Create: `src/_components/editor/color-section.tsx`
- Create: `src/_components/editor/logo-section.tsx`
- Create: `src/_components/editor/logo-picker-dialog.tsx`

- [ ] **Step 1: Create `text-section.tsx`**

```tsx
import { fitFontSize } from "~/server/label/fit-font";
import { SLOTS } from "~/server/label/slots";
import type { LabelConfig } from "~/server/label/types";

const FIELDS: Array<{ key: keyof Pick<LabelConfig, "name" | "size" | "price" | "footerLine1" | "footerLine2">; label: string; slot: keyof typeof SLOTS }> = [
  { key: "name", label: "Name", slot: "name" },
  { key: "size", label: "Size", slot: "size" },
  { key: "price", label: "Price", slot: "price" },
  { key: "footerLine1", label: "Footer line 1", slot: "footerLine1" },
  { key: "footerLine2", label: "Footer line 2", slot: "footerLine2" },
];

export function TextSection({
  config,
  onChange,
}: {
  config: LabelConfig;
  onChange: (next: LabelConfig) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Text</h2>
      {FIELDS.map(({ key, label, slot }) => {
        const value = config[key];
        const slotMeta = SLOTS[slot];
        const fitted = fitFontSize(value, slotMeta.width, slotMeta.defaultFontSize, 24);
        const shrunk = value.length > 0 && fitted < slotMeta.defaultFontSize;
        return (
          <label key={key} className="block">
            <span className="mb-1 block text-xs text-zinc-400">{label}</span>
            <input
              value={value}
              onChange={(e) => onChange({ ...config, [key]: e.target.value })}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm focus:bg-zinc-800"
              placeholder={label}
            />
            {shrunk ? (
              <p className="mt-1 text-[11px] italic text-amber-500">
                auto-shrunk to fit ({fitted}px)
              </p>
            ) : null}
          </label>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 2: Create `color-section.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `logo-picker-dialog.tsx`**

```tsx
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
    if (res.ok) setLogos(await res.json());
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
          const body = await res.json().catch(() => ({}));
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
    onDrop,
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
```

- [ ] **Step 4: Create `logo-section.tsx`**

```tsx
import { useState } from "react";
import { Button } from "~/_components/ui/button";
import { LogoPickerDialog } from "./logo-picker-dialog";
import type { LabelConfig } from "~/server/label/types";

export function LogoSection({
  config,
  onChange,
}: {
  config: LabelConfig;
  onChange: (next: LabelConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Logo</h2>
      <div className="flex items-center gap-3 rounded-lg bg-zinc-900 p-3">
        <div className="flex h-16 w-16 items-center justify-center rounded border border-zinc-700 bg-zinc-950">
          {config.logoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logos/${config.logoId}/file`} alt="logo" className="max-h-full max-w-full" />
          ) : (
            <span className="text-xs text-zinc-500">none</span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Choose logo
        </Button>
      </div>
      <LogoPickerDialog
        open={open}
        onOpenChange={setOpen}
        selectedId={config.logoId}
        onSelect={(id) => onChange({ ...config, logoId: id })}
      />
    </section>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/_components/editor/text-section.tsx src/_components/editor/color-section.tsx src/_components/editor/logo-section.tsx src/_components/editor/logo-picker-dialog.tsx
git commit -m "feat: editor sections + logo picker"
```

---

### Task E3: Download popover

**Files:**
- Create: `src/_components/editor/download-popover.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { Popover } from "~/_components/ui/popover";

export function DownloadPopover({
  labelId,
  disabled,
}: {
  labelId: string | null;
  disabled?: boolean;
}) {
  const [scale, setScale] = useState<1 | 2 | 4>(2);
  const [rotate, setRotate] = useState<0 | 90>(0);

  const buildUrl = (format: "png" | "svg") => {
    if (!labelId) return "#";
    const params = new URLSearchParams();
    if (rotate === 90) params.set("rotate", "90");
    if (format === "png") params.set("scale", String(scale));
    return `/api/labels/${labelId}/download.${format}?${params.toString()}`;
  };

  return (
    <Popover
      trigger={
        <Button variant="secondary" disabled={disabled || !labelId}>
          <Download className="h-4 w-4" /> Download
        </Button>
      }
      align="end"
    >
      <div className="w-64 space-y-3">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">PNG scale</p>
          <div className="flex gap-2">
            {[1, 2, 4].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={scale === s ? "primary" : "secondary"}
                onClick={() => setScale(s as 1 | 2 | 4)}
              >
                {s}×
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">Rotate</p>
          <div className="flex gap-2">
            <Button size="sm" variant={rotate === 0 ? "primary" : "secondary"} onClick={() => setRotate(0)}>
              0°
            </Button>
            <Button size="sm" variant={rotate === 90 ? "primary" : "secondary"} onClick={() => setRotate(90)}>
              90°
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <a
            href={buildUrl("png")}
            className="rounded-lg bg-accent px-3 py-2 text-center text-sm hover:bg-accent-hover"
          >
            Download PNG
          </a>
          <a
            href={buildUrl("svg")}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm hover:bg-zinc-700"
          >
            Download SVG
          </a>
        </div>
      </div>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/_components/editor/download-popover.tsx
git commit -m "feat: download popover"
```

---

### Task E4: Editor page (shared component + two routes)

**Files:**
- Create: `src/_components/editor/editor-page.tsx`
- Create: `src/pages/edit/draft/[id].tsx`
- Create: `src/pages/edit/label/[id].tsx`

- [ ] **Step 1: Create `editor-page.tsx`** (shared logic)

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DEFAULT_CONFIG, type LabelConfig } from "~/server/label/types";

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
      const body = await res.json();
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
              <Button onClick={promote}>
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
```

- [ ] **Step 2: Create `src/pages/edit/draft/[id].tsx`**

```tsx
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
        config: labelConfigSchema.parse(JSON.parse(row.config)),
      },
    },
  };
};

export default function DraftEdit({ id, initial }: Props) {
  return <EditorPage id={id} kind="draft" initial={initial} />;
}
```

- [ ] **Step 3: Create `src/pages/edit/label/[id].tsx`**

```tsx
import type { GetServerSideProps } from "next";
import { eq } from "drizzle-orm";
import { EditorPage } from "~/_components/editor/editor-page";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { labelConfigSchema, type LabelConfig } from "~/server/label/types";

interface Props {
  id: string;
  initial: { name: string; config: LabelConfig };
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = ctx.params?.id;
  if (typeof id !== "string") return { notFound: true };
  const db = getDb();
  const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return { notFound: true };
  return {
    props: {
      id,
      initial: {
        name: row.name,
        config: labelConfigSchema.parse(JSON.parse(row.config)),
      },
    },
  };
};

export default function LabelEdit({ id, initial }: Props) {
  return <EditorPage id={id} kind="saved" initial={initial} />;
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
Open `http://localhost:3000/edit/draft/foo` — expect 404 page since the draft doesn't exist (no error toast required).

(Full editor flow is verified after gallery exists in E5.)

- [ ] **Step 5: Commit**

```bash
git add src/_components/editor/editor-page.tsx src/pages/edit/
git commit -m "feat: editor page (draft + saved variants)"
```

---

### Task E5: Gallery page

**Files:**
- Create: `src/_components/gallery/draft-card.tsx`
- Create: `src/_components/gallery/label-card.tsx`
- Create: `src/_components/gallery/batch-toolbar.tsx`
- Replace: `src/pages/index.tsx`

- [ ] **Step 1: Create `draft-card.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `label-card.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `batch-toolbar.tsx`**

```tsx
import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "~/_components/ui/button";
import { Popover } from "~/_components/ui/popover";

export function BatchToolbar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const [scale, setScale] = useState<1 | 2 | 4>(2);
  const [rotate, setRotate] = useState<0 | 90>(0);

  if (selectedIds.length === 0) return null;

  const buildUrl = (format: "png" | "svg") => {
    const params = new URLSearchParams({
      ids: selectedIds.join(","),
      format,
    });
    if (format === "png") params.set("scale", String(scale));
    if (rotate === 90) params.set("rotate", "90");
    return `/api/labels/batch-download?${params.toString()}`;
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 shadow-xl">
      <span className="text-sm">{selectedIds.length} selected</span>
      <Popover
        trigger={
          <Button size="sm" variant="primary">
            <Download className="h-4 w-4" /> Download
          </Button>
        }
        align="center"
      >
        <div className="w-64 space-y-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">PNG scale</p>
            <div className="flex gap-2">
              {[1, 2, 4].map((s) => (
                <Button key={s} size="sm" variant={scale === s ? "primary" : "secondary"} onClick={() => setScale(s as 1 | 2 | 4)}>
                  {s}×
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">Rotate</p>
            <div className="flex gap-2">
              <Button size="sm" variant={rotate === 0 ? "primary" : "secondary"} onClick={() => setRotate(0)}>0°</Button>
              <Button size="sm" variant={rotate === 90 ? "primary" : "secondary"} onClick={() => setRotate(90)}>90°</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a href={buildUrl("png")} className="rounded-lg bg-accent px-3 py-2 text-center text-sm hover:bg-accent-hover">PNG zip</a>
            <a href={buildUrl("svg")} className="rounded-lg bg-zinc-800 px-3 py-2 text-center text-sm hover:bg-zinc-700">SVG zip</a>
          </div>
        </div>
      </Popover>
      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/pages/index.tsx`**

```tsx
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
      fetch("/api/drafts").then((r) => r.json()),
      fetch("/api/labels").then((r) => r.json()),
    ]);
    setDrafts(draftsRes);
    setLabels(labelsRes);
  }

  useEffect(() => { void refresh(); }, []);

  const newLabel = async () => {
    const res = await fetch("/api/drafts", { method: "POST" });
    const { id } = await res.json();
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
    const draft = await fetch("/api/drafts", { method: "POST" }).then((r) => r.json());
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
            <Button onClick={newLabel}>
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
                <DraftCard key={d.id} draft={d} onDelete={deleteDraft} />
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
                  onDelete={deleteLabel}
                  onDuplicate={duplicateLabel}
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
```

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`
Open `http://localhost:3000`. Expect: empty gallery with "No drafts yet" / "No saved labels yet". Click "New label" → redirected to `/edit/draft/...`. Type a name → preview updates after a moment. Click "Save label" → redirected to `/edit/label/...`. Go back to `/` → see the saved label card.

- [ ] **Step 6: Commit**

```bash
git add src/_components/gallery/ src/pages/index.tsx
git commit -m "feat: gallery page with drafts + saved + multi-select"
```

---

### Task E6: Logos page

**Files:**
- Create: `src/pages/logos.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
    if (res.ok) setLogos(await res.json());
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
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `upload failed (${res.status})`);
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const dz = useDropzone({
    onDrop,
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
      const body = await res.json();
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
                    <Button size="sm" variant="ghost" onClick={() => rename(logo.id, logo.filename)} aria-label="Rename">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(logo.id)} aria-label="Delete">
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
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`. Open `http://localhost:3000/logos`. Drop an SVG → it appears with "Recolorable SVG" badge. Drop a PNG → appears with mime type. Click rename → enter new name → list updates. Click delete → confirm → it disappears.

- [ ] **Step 3: Commit**

```bash
git add src/pages/logos.tsx
git commit -m "feat: logos management page"
```

---

## Phase F — Cleanup, deploy, end-to-end

### Task F1: Remove dead code from PoC

**Files:**
- Delete: `src/_components/label-generator.tsx`
- Delete: `src/_hooks/use-debounce.ts`
- Delete: `public/label_template.svg`
- Delete: `out.png`
- Modify: `package.json` (remove `geist` if unused)

- [ ] **Step 1: Confirm deletions are safe**

Run: `grep -r "label-generator" src/`
Expected: no matches (gallery + editor replaced it).

Run: `grep -r "useDebounce" src/`
Expected: no matches (replaced by `useDebouncedSave`).

Run: `grep -r "label_template.svg" src/`
Expected: no matches.

- [ ] **Step 2: Delete files**

```bash
rm src/_components/label-generator.tsx
rm src/_hooks/use-debounce.ts
rm public/label_template.svg
rm out.png
```

- [ ] **Step 3: Remove geist from package.json**

Open `package.json`, remove `"geist": "^1.3.0"` from `dependencies`, run `npm install`.

Also remove `"geist"` from `transpilePackages` in `next.config.js`:

```js
const config = {
  reactStrictMode: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
};
```

- [ ] **Step 4: Run tests + build**

```bash
npm test
npm run build
```

Expected: all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -u src/ public/ package.json package-lock.json next.config.js
git commit -m "chore: remove PoC label-generator and unused deps"
```

---

### Task F2: Docker + Coolify config

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `Dockerfile`

- [ ] **Step 1: Update `docker-compose.yaml`**

```yaml
services:
  matemat:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - SERVICE_FQDN_MATEMAT_3000
      - GENERATOR_URL=http://og-image-generator:3003/og-image.png
      - GENERATOR_USER=matemat
      - GENERATOR_PASS=$SERVICE_PASSWORD_GENERATOR
      - INTERNAL_BASE_URL=http://matemat:3000
      - DATABASE_PATH=/data/matemat.db
      - UPLOADS_DIR=/data/uploads
    volumes:
      - matemat-data:/data
    depends_on:
      - og-image-generator
    labels:
      - traefik.enable=true
      - traefik.http.services.matemat.loadbalancer.server.port=3000
      - traefik.http.routers.http-0-sw6l5xslx7w42qtaudg4sbkk-matemat.service=matemat
      - traefik.http.routers.https-0-sw6l5xslx7w42qtaudg4sbkk-matemat.service=matemat

  og-image-generator:
    build:
      context: ./og-image-generator
      dockerfile: Dockerfile
    environment:
      - AUTH_USERS=matemat
      - AUTH_USER_matemat_PASSWORD=$SERVICE_PASSWORD_GENERATOR

volumes:
  matemat-data:
```

- [ ] **Step 2: Update `Dockerfile` to ensure `/data` exists at runtime**

Replace contents:

```Dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

ENV NODE_ENV=production
RUN mkdir -p /data/uploads
EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yaml Dockerfile
git commit -m "chore: docker volumes + new env vars"
```

---

### Task F3: End-to-end manual verification

This task has no code; it's the final smoke test. Mark it done only after each step works.

- [ ] **Step 1: Cold start with fresh data dir**

```bash
rm -rf data
npm run dev
```

Open `http://localhost:3000` → expect empty gallery.

- [ ] **Step 2: Logo upload**

Open `/logos`. Upload an SVG (e.g. `https://upload.wikimedia.org/wikipedia/commons/0/02/Wikipedia-logo-en-big.svg` or any local SVG). Verify "Recolorable SVG" badge.

Upload a PNG. Verify it shows mime type.

- [ ] **Step 3: Create + edit a label**

From `/`, click "New label". Editor opens. Type:
- Name: `fritz-kola`
- Size: `0,33 L`
- Price: `2,00 €`
- Footer 1: `Koffein: 25 mg/100 ml`
- Footer 2: `Zucker: 9,9 g/100 ml`

Open color picker → set foreground white, background black.
Open logo picker → pick the uploaded SVG.

Verify preview updates within ~1s of each change.

- [ ] **Step 4: Save**

Click "Save label". Enter name "Fritz-Kola 0,33L". URL becomes `/edit/label/...`. Header shows "Saved". Go back to `/` → label appears in gallery.

- [ ] **Step 5: Re-edit**

Click the saved label card. Editor reopens with all values. Change foreground color → preview updates → status flips to "Saving…" then "Saved".

- [ ] **Step 6: Single download**

In editor, click Download → PNG 2× → file downloads. Open it → confirm correct rendering.
Click Download → SVG → file downloads. Open it in a browser → confirm same image.

- [ ] **Step 7: Batch download**

On `/`, select 2+ labels via checkbox. Bottom toolbar shows. Click Download → SVG zip → unzip → confirm one SVG per label.

- [ ] **Step 8: Logo deletion guard**

On `/logos`, attempt to delete a logo in use. Confirm dialog warns about usage. Cancel. Then confirm force-delete → reload editor of affected label → logo slot now empty (no error).

- [ ] **Step 9: Long text auto-shrink**

Create a new label with a very long name (e.g. 50 chars). In the editor's text section, expect "auto-shrunk to fit (XXpx)" note. Preview shows the text fits within bounds.

- [ ] **Step 10: Rotation**

Click Download → 90° → SVG. Open downloaded SVG → confirm landscape orientation, content rotated 90°.

- [ ] **Step 11: Final commit (if anything was tweaked)**

```bash
git status
# If clean, nothing to commit. Otherwise commit any final adjustments.
```

---

## Self-review checklist

These are notes from reviewing the plan against the spec. Skim before kicking off implementation.

**Spec coverage:**
- Persistence (SQLite + disk volume): A4, A5, B6, F2 ✓
- Dynamic SVG generation with auto-shrink: B2, B3, B4, B5 ✓
- Logo upload + recoloring + as-is for PNG/JPEG: B6, B7, C4, C5 ✓
- Drafts + saved + promote: A4 schema, C2, C3 ✓
- SVG endpoint consumed by og-image-generator: C6, C7 ✓
- Single-label PNG/SVG download with scale + rotate: C8 ✓
- Batch download as zip: C9 ✓
- UI: dark theme + Inter (D1), gallery (E5), editor (E4), logos page (E6), color picker / logo picker / download popover (D4, E2, E3) ✓
- Docker volume + env vars: F2 ✓
- Old PoC code removed: F1 ✓

**Type consistency:** `LabelConfig` from `~/server/label/types` is imported in render.ts, all API routes, all editor components, and getServerSideProps loaders. `LoadedLogo` is consistent across `loadLogo` and `renderLabelSvg`. SlotKey types align between `slots.ts` and `render.ts`. The `kind` query param is `"draft" | "saved"` everywhere.

**Placeholder scan:** No "TBD" or "implement later" markers present. Each step has the actual code.
