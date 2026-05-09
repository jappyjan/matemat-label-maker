# Label Subtitle Implementation Plan (slots-based architecture)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centered, italic, smaller-than-title `subtitle` text field to the matemat label, rendered directly under the title, with auto-shrink behavior that matches the existing text slots.

**Architecture:** Five-file change against the slots-based renderer. Schema (`types.ts`) gains a `subtitle` field. SlotBox (`slots.ts`) gets an optional `fontStyle` property; a new `subtitle` slot is added; size/logo/price y-coordinates shift down by 70px. The renderer (`render.ts`) emits the new `font-style` attribute and includes subtitle in `TEXT_SLOTS`. The form (`text-section.tsx`) gets a new input. Existing `render.test.ts` is extended.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zod (schema), Drizzle/SQLite (storage; no migration), Vitest (tests), Inter font (rendered server-side via the og-image-generator Docker container).

**Spec:** `docs/superpowers/specs/2026-05-09-label-subtitle-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/server/label/types.ts` | LabelConfig schema | add `subtitle` field |
| `src/server/label/slots.ts` | Slot geometry + font metadata | extend SlotBox with `fontStyle?`, add `subtitle` slot, shift size/logo/price |
| `src/server/label/render.ts` | SVG emission | add `subtitle` to TEXT_SLOTS, emit `font-style` from slot meta |
| `src/_components/editor/text-section.tsx` | Editor form section | add `Subtitle` input row |
| `tests/server/label/render.test.ts` | Renderer tests | add `subtitle: ""` to baseConfig, add italic/centering/empty-subtitle tests |

No new files. No DB migration (config column is JSON, schema parse fills defaults on read).

---

## Task 1: Add `subtitle` to LabelConfig schema

**Files:**
- Modify: `src/server/label/types.ts:3-14`
- Modify: `tests/server/label/render.test.ts:5-13` (compat update — must happen with the schema change to keep `npm test` green)

- [ ] **Step 1: Update test fixture FIRST so the schema change doesn't break the build**

Open `tests/server/label/render.test.ts`. Change `baseConfig` from:

```ts
const baseConfig: LabelConfig = {
  name: "fritz-kola",
  size: "0,33 L",
  price: "2,00 €",
  footerLine1: "Koffein: 25 mg/100 ml",
  footerLine2: "Zucker: 9,9 g/100 ml",
  logoId: null,
  colors: { background: "#000000", foreground: "#ffffff" },
};
```

To:

```ts
const baseConfig: LabelConfig = {
  name: "fritz-kola",
  subtitle: "",
  size: "0,33 L",
  price: "2,00 €",
  footerLine1: "Koffein: 25 mg/100 ml",
  footerLine2: "Zucker: 9,9 g/100 ml",
  logoId: null,
  colors: { background: "#000000", foreground: "#ffffff" },
};
```

(At this point, TypeScript sees `LabelConfig` without `subtitle` yet, so this fixture line will appear as an extra unknown property. That's fine — Step 2 adds it to the schema in the same commit.)

- [ ] **Step 2: Add `subtitle` to the schema**

Open `src/server/label/types.ts`. Change:

```ts
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
```

To:

```ts
export const labelConfigSchema = z.object({
  name: z.string().default(""),
  subtitle: z.string().default(""),
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
```

(Single line addition between `name` and `size`.)

- [ ] **Step 3: Run typecheck and tests**

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
npx tsc --noEmit
npm test
```

Expected: `tsc` passes (no type errors). `npm test` passes — the existing renderer tests still work because they don't depend on slot positions or subtitle behavior yet. The fixture's new `subtitle: ""` is harmless to existing assertions (no test currently checks "subtitle" by name).

If `tsc` reports type errors anywhere else (e.g., other tests with explicit LabelConfig literals), do NOT add `subtitle` to those. They are HTTP request bodies parsed via `labelConfigSchema.parse(...)`, which fills the default. Re-check the spec — the only typed `LabelConfig` literal is in `render.test.ts`.

If you DO find a typed LabelConfig literal elsewhere that errors, add `subtitle: ""` to it. (Spec was written against current main; any new such literal added since is fair game.)

- [ ] **Step 4: Commit**

```bash
git add src/server/label/types.ts tests/server/label/render.test.ts
git commit -m "feat: add subtitle field to LabelConfig schema

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Add `subtitle` slot, extend `SlotBox` with `fontStyle`, shift size/logo/price

**Files:**
- Modify: `src/server/label/slots.ts`

- [ ] **Step 1: Open `src/server/label/slots.ts` and replace the entire file content**

Current file:

```ts
export type Align = "start" | "middle" | "end";

export interface SlotBox {
  x: number;
  y: number;        // baseline y for text, top y for logo image
  width: number;
  height: number;
  defaultFontSize: number;
  align?: Align;    // text alignment within the slot; defaults to "start" (left)
}

export const CANVAS = { width: 630, height: 800 } as const;

export const SLOTS = {
  name:        { x: 60,  y: 130, width: 510, height: 120, defaultFontSize: 96, align: "middle" as Align },
  size:        { x: 60,  y: 200, width: 510, height: 60,  defaultFontSize: 42, align: "middle" as Align },
  logo:        { x: 165, y: 260, width: 300, height: 220, defaultFontSize: 0,  align: "start"  as Align },
  price:       { x: 60,  y: 600, width: 510, height: 100, defaultFontSize: 88, align: "middle" as Align },
  footerLine1: { x: 60,  y: 740, width: 510, height: 28,  defaultFontSize: 22, align: "start"  as Align },
  footerLine2: { x: 60,  y: 772, width: 510, height: 28,  defaultFontSize: 22, align: "start"  as Align },
} satisfies Record<string, SlotBox>;

export type SlotKey = keyof typeof SLOTS;
```

Replace with:

```ts
export type Align = "start" | "middle" | "end";

export interface SlotBox {
  x: number;
  y: number;        // baseline y for text, top y for logo image
  width: number;
  height: number;
  defaultFontSize: number;
  align?: Align;    // text alignment within the slot; defaults to "start" (left)
  fontStyle?: "italic"; // optional; only italic is supported today
}

export const CANVAS = { width: 630, height: 800 } as const;

export const SLOTS = {
  name:        { x: 60,  y: 130, width: 510, height: 120, defaultFontSize: 96, align: "middle" as Align },
  subtitle:    { x: 60,  y: 205, width: 510, height: 50,  defaultFontSize: 40, align: "middle" as Align, fontStyle: "italic" as const },
  size:        { x: 60,  y: 270, width: 510, height: 60,  defaultFontSize: 42, align: "middle" as Align },
  logo:        { x: 165, y: 330, width: 300, height: 220, defaultFontSize: 0,  align: "start"  as Align },
  price:       { x: 60,  y: 670, width: 510, height: 100, defaultFontSize: 88, align: "middle" as Align },
  footerLine1: { x: 60,  y: 740, width: 510, height: 28,  defaultFontSize: 22, align: "start"  as Align },
  footerLine2: { x: 60,  y: 772, width: 510, height: 28,  defaultFontSize: 22, align: "start"  as Align },
} satisfies Record<string, SlotBox>;

export type SlotKey = keyof typeof SLOTS;
```

Three changes:
1. Added `fontStyle?: "italic"` to the `SlotBox` interface.
2. Inserted the `subtitle` slot between `name` and `size`.
3. Shifted `size` (y=200→270), `logo` (y=260→330), `price` (y=600→670) — each by +70.

- [ ] **Step 2: Run typecheck and tests**

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
npx tsc --noEmit
npm test
```

Expected: `tsc` passes. `npm test` passes — render tests don't assert specific y values, and the new subtitle slot isn't yet wired into `TEXT_SLOTS` so the renderer output is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/server/label/slots.ts
git commit -m "feat: add subtitle slot with italic font-style; shift size/logo/price down

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Wire `subtitle` into the renderer (TDD)

**Files:**
- Modify: `tests/server/label/render.test.ts` (add 2 failing tests first)
- Modify: `src/server/label/render.ts:6-12` (then add subtitle to TEXT_SLOTS)

- [ ] **Step 1: Write failing tests for subtitle rendering**

Open `tests/server/label/render.test.ts`. Inside the `describe("renderLabelSvg", ...)` block, add these two tests after the existing `escapes XML-special characters in text` test (around line 38):

```ts
  test("renders subtitle text when set, centered at canvas midline", () => {
    const svg = renderLabelSvg(
      { ...baseConfig, subtitle: "Classic Refreshing" },
      null,
    );
    expect(svg).toContain("Classic Refreshing");
    // subtitle slot is centered: text-anchor="middle" + tspan x="315" (canvas center)
    expect(svg).toMatch(/<text[^>]*text-anchor="middle"[^>]*>\s*<tspan[^>]*x="315"[^>]*>Classic Refreshing<\/tspan>/);
  });

  test("omits subtitle element when subtitle is empty", () => {
    const svg = renderLabelSvg({ ...baseConfig, subtitle: "" }, null);
    // empty subtitle → renderTextSlot returns "", so no element with the subtitle text appears
    // (Other elements may contain text-anchor="middle" — just verify no subtitle-like content renders)
    expect(svg).not.toContain("Classic Refreshing");
  });
```

(The first test asserts both presence of the text AND its centered placement. The second test guards the empty-subtitle case.)

- [ ] **Step 2: Run the new tests to verify they FAIL**

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
npm test -- tests/server/label/render.test.ts
```

Expected: the new "renders subtitle text when set" test FAILS (text "Classic Refreshing" not found in SVG, because the renderer's `TEXT_SLOTS` doesn't include subtitle yet). The "omits subtitle element when subtitle is empty" test PASSES trivially (the text never gets rendered today, so it's correctly absent).

- [ ] **Step 3: Wire subtitle into the renderer**

Open `src/server/label/render.ts`. Change lines 6–12:

```ts
const TEXT_SLOTS: Array<{ key: Exclude<SlotKey, "logo">; field: keyof Pick<LabelConfig, "name" | "size" | "price" | "footerLine1" | "footerLine2"> }> = [
  { key: "name",        field: "name" },
  { key: "size",        field: "size" },
  { key: "price",       field: "price" },
  { key: "footerLine1", field: "footerLine1" },
  { key: "footerLine2", field: "footerLine2" },
];
```

To:

```ts
const TEXT_SLOTS: Array<{ key: Exclude<SlotKey, "logo">; field: keyof Pick<LabelConfig, "name" | "subtitle" | "size" | "price" | "footerLine1" | "footerLine2"> }> = [
  { key: "name",        field: "name" },
  { key: "subtitle",    field: "subtitle" },
  { key: "size",        field: "size" },
  { key: "price",       field: "price" },
  { key: "footerLine1", field: "footerLine1" },
  { key: "footerLine2", field: "footerLine2" },
];
```

Two changes: `"subtitle"` added to the `Pick<LabelConfig, ...>` type union, and `{ key: "subtitle", field: "subtitle" }` inserted between `name` and `size`.

- [ ] **Step 4: Run tests to verify they PASS**

```bash
npm test -- tests/server/label/render.test.ts
```

Expected: all renderer tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add tests/server/label/render.test.ts src/server/label/render.ts
git commit -m "feat: render subtitle in label SVG

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Emit `font-style` attribute for italic slots (TDD)

**Files:**
- Modify: `tests/server/label/render.test.ts` (add failing test)
- Modify: `src/server/label/render.ts:25-44` (then update renderTextSlot)

- [ ] **Step 1: Write failing test for italic emission**

Open `tests/server/label/render.test.ts`. Add this test inside `describe("renderLabelSvg", ...)`, after the two tests added in Task 3:

```ts
  test("emits font-style=\"italic\" for the subtitle slot only", () => {
    const svg = renderLabelSvg(
      { ...baseConfig, subtitle: "Classic Refreshing" },
      null,
    );
    // subtitle's <text> element must carry font-style="italic"
    expect(svg).toMatch(/<text[^>]*font-style="italic"[^>]*>\s*<tspan[^>]*>Classic Refreshing<\/tspan>/);
    // No other slot should have font-style — count occurrences
    const italicMatches = svg.match(/font-style="italic"/g) ?? [];
    expect(italicMatches.length).toBe(1);
  });
```

- [ ] **Step 2: Run the new test to verify it FAILS**

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
npm test -- tests/server/label/render.test.ts
```

Expected: the new test FAILS — SVG does not contain `font-style="italic"` because the renderer does not emit it yet.

- [ ] **Step 3: Update `renderTextSlot` to emit `font-style` from slot metadata**

Open `src/server/label/render.ts`. Replace the `renderTextSlot` function (lines 25–44):

```ts
function renderTextSlot(text: string, slot: typeof SLOTS[Exclude<SlotKey, "logo">], color: string): string {
  if (!text) return "";
  const fontSize = fitFontSize(text, slot.width, slot.defaultFontSize, MIN_FONT);
  const naturalWidth = measureTextWidth(text, fontSize);
  const safe = escapeXml(text);
  // Emit textLength as a renderer-side safety net when text was shrunk OR
  // is approximation-close to the slot edge — our glyph widths are estimates
  // and Inter's actual rendering can be slightly wider than our table.
  const tight = fontSize < slot.defaultFontSize || naturalWidth > slot.width * 0.9;
  const lengthAttrs = tight
    ? ` textLength="${slot.width}" lengthAdjust="spacingAndGlyphs"`
    : "";
  const align = slot.align ?? "start";
  // text-anchor anchors the text at x: "start" left, "middle" center, "end" right.
  const tspanX =
    align === "middle" ? slot.x + slot.width / 2
    : align === "end"  ? slot.x + slot.width
    : slot.x;
  return `<text font-family="Inter" font-size="${fontSize}" fill="${color}" text-anchor="${align}"><tspan x="${tspanX}" y="${slot.y}"${lengthAttrs}>${safe}</tspan></text>`;
}
```

With:

```ts
function renderTextSlot(text: string, slot: typeof SLOTS[Exclude<SlotKey, "logo">], color: string): string {
  if (!text) return "";
  const fontSize = fitFontSize(text, slot.width, slot.defaultFontSize, MIN_FONT);
  const naturalWidth = measureTextWidth(text, fontSize);
  const safe = escapeXml(text);
  // Emit textLength as a renderer-side safety net when text was shrunk OR
  // is approximation-close to the slot edge — our glyph widths are estimates
  // and Inter's actual rendering can be slightly wider than our table.
  const tight = fontSize < slot.defaultFontSize || naturalWidth > slot.width * 0.9;
  const lengthAttrs = tight
    ? ` textLength="${slot.width}" lengthAdjust="spacingAndGlyphs"`
    : "";
  const align = slot.align ?? "start";
  // text-anchor anchors the text at x: "start" left, "middle" center, "end" right.
  const tspanX =
    align === "middle" ? slot.x + slot.width / 2
    : align === "end"  ? slot.x + slot.width
    : slot.x;
  const styleAttr = slot.fontStyle ? ` font-style="${slot.fontStyle}"` : "";
  return `<text font-family="Inter" font-size="${fontSize}" fill="${color}" text-anchor="${align}"${styleAttr}><tspan x="${tspanX}" y="${slot.y}"${lengthAttrs}>${safe}</tspan></text>`;
}
```

Two additions: a `styleAttr` variable that resolves to ` font-style="..."` when set (or empty string), and its insertion into the `<text>` tag right after `text-anchor="..."`.

- [ ] **Step 4: Run tests to verify all pass**

```bash
npm test
```

Expected: all tests pass, including the new italic test and the centering test from Task 3.

- [ ] **Step 5: Commit**

```bash
git add tests/server/label/render.test.ts src/server/label/render.ts
git commit -m "feat: emit font-style attribute for slots with italic configured

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Add subtitle input to the editor form

**Files:**
- Modify: `src/_components/editor/text-section.tsx:5-11`

- [ ] **Step 1: Update the FIELDS array and its type**

Open `src/_components/editor/text-section.tsx`. Change lines 5–11:

```tsx
const FIELDS: Array<{ key: keyof Pick<LabelConfig, "name" | "size" | "price" | "footerLine1" | "footerLine2">; label: string; slot: keyof typeof SLOTS }> = [
  { key: "name", label: "Name", slot: "name" },
  { key: "size", label: "Size", slot: "size" },
  { key: "price", label: "Price", slot: "price" },
  { key: "footerLine1", label: "Footer line 1", slot: "footerLine1" },
  { key: "footerLine2", label: "Footer line 2", slot: "footerLine2" },
];
```

To:

```tsx
const FIELDS: Array<{ key: keyof Pick<LabelConfig, "name" | "subtitle" | "size" | "price" | "footerLine1" | "footerLine2">; label: string; slot: keyof typeof SLOTS }> = [
  { key: "name", label: "Name", slot: "name" },
  { key: "subtitle", label: "Subtitle", slot: "subtitle" },
  { key: "size", label: "Size", slot: "size" },
  { key: "price", label: "Price", slot: "price" },
  { key: "footerLine1", label: "Footer line 1", slot: "footerLine1" },
  { key: "footerLine2", label: "Footer line 2", slot: "footerLine2" },
];
```

Two changes: `"subtitle"` added to the `Pick<LabelConfig, ...>` union, and `{ key: "subtitle", label: "Subtitle", slot: "subtitle" }` inserted between `name` and `size`.

- [ ] **Step 2: Verify lint and typecheck**

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
npx tsc --noEmit
npm run lint
```

Expected: no new errors. (Existing lint warnings are fine.)

- [ ] **Step 3: Commit**

```bash
git add src/_components/editor/text-section.tsx
git commit -m "feat: add subtitle input row to editor text section

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: End-to-end verification through the dev server

**Files:**
- No file changes; this task is a manual smoke test against the running stack.

- [ ] **Step 1: Ensure the og-image-generator container is running**

The brainstorming session left a Docker container running on port 3003 with the Inter-bearing image. Verify:

```bash
docker ps --filter name=og-test --format "{{.Names}} {{.Status}}"
```

If empty, start one:

```bash
docker run -d --name og-test --rm -p 3003:3003 \
  -e AUTH_USERS=matemat -e AUTH_USER_matemat_PASSWORD=devpass \
  t3code-17f56395-og-image-generator
```

If the image is missing, build it from the project:

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
docker compose build og-image-generator
```

then re-run the `docker run` command above.

- [ ] **Step 2: Start the Next.js dev server with prod-like env**

```bash
cd /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395
mkdir -p ./data/uploads
GENERATOR_URL=http://localhost:3003/og-image.png \
  GENERATOR_USER=matemat \
  GENERATOR_PASS=devpass \
  INTERNAL_BASE_URL=http://host.docker.internal:3000 \
  DATABASE_PATH=./data/matemat-subtitle-test.db \
  UPLOADS_DIR=./data/uploads \
  SKIP_ENV_VALIDATION=1 \
  npm run dev > /tmp/nextdev.log 2>&1 &
```

Use `run_in_background: true`. Wait for ready:

```bash
for i in $(seq 1 30); do
  if curl -sSf http://localhost:3000 > /dev/null 2>&1; then
    echo "ready after ${i}s"
    break
  fi
  sleep 1
done
```

If it doesn't come up, check `/tmp/nextdev.log` and report BLOCKED.

- [ ] **Step 3: Create a draft and configure it with a subtitle**

```bash
# Create draft
DRAFT_ID=$(curl -sS -X POST http://localhost:3000/api/drafts -H 'content-type: application/json' -d '{}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
echo "draft id: $DRAFT_ID"

# Set config including subtitle
curl -sS -X PUT "http://localhost:3000/api/drafts/$DRAFT_ID" \
  -H 'content-type: application/json' \
  -d '{
    "name": "fritz-kola",
    "subtitle": "Classic Refreshing",
    "size": "0,33 L",
    "price": "2,00 €",
    "footerLine1": "Koffein: 25 mg/100 ml",
    "footerLine2": "Zucker: 9,9 g/100 ml",
    "logoId": null,
    "colors": { "background": "#000000", "foreground": "#ffffff" }
  }' -w "\nput: HTTP %{http_code}\n"
```

Expected: PUT returns HTTP 200.

- [ ] **Step 4: Fetch the rendered SVG and verify italic subtitle is present**

```bash
SVG=$(curl -sS "http://localhost:3000/api/labels/$DRAFT_ID/svg?kind=draft")
echo "$SVG" | grep -o 'font-style="italic"' | head -1
echo "$SVG" | grep -o '>Classic Refreshing<' | head -1
```

Expected:
- `font-style="italic"` appears at least once
- `>Classic Refreshing<` appears (text content present)

- [ ] **Step 5: Render the SVG to PNG and visually inspect**

```bash
curl -sS -o /tmp/e2e_subtitle_normal.png \
  -w "png: HTTP %{http_code}\n" \
  "http://localhost:3000/api/matemat-label?id=$DRAFT_ID&kind=draft"
file /tmp/e2e_subtitle_normal.png
```

Expected: HTTP 200, output is `PNG image data` of dimension 630×800.

Open `/tmp/e2e_subtitle_normal.png` and confirm the subtitle "Classic Refreshing" appears in italic, centered, directly under "fritz-kola", with "0,33 L" comfortably below.

- [ ] **Step 6: Stop the dev server**

```bash
pkill -f "next dev" || true
sleep 1
lsof -i :3000 -P 2>/dev/null | head -3
```

Expected: port 3000 free.

- [ ] **Step 7: Verify no uncommitted changes**

```bash
git -C /Users/jappy/.t3/worktrees/matemat-label-maker/t3code-17f56395 status
```

Expected: clean. (The DB file at `./data/matemat-subtitle-test.db` may exist if `data/` is gitignored — verify with `cat .gitignore | grep -i data`.)

No commit for this task — it's a verification step.

---

## Self-Review (already completed before saving)

**1. Spec coverage:**
- types.ts schema change → Task 1 ✓
- slots.ts SlotBox extension + subtitle slot + position shifts → Task 2 ✓
- render.ts TEXT_SLOTS update → Task 3 ✓
- render.ts font-style emission → Task 4 ✓
- text-section.tsx form input → Task 5 ✓
- render.test.ts: baseConfig fixture update + 3 new tests → Tasks 1, 3, 4 ✓
- E2E pipeline verification → Task 6 ✓
- Non-goals (no migration, no font-weight, no italic glyph table, no conditional layout): not implemented (correctly) ✓

**2. Placeholder scan:** No "TBD"/"TODO"/"figure out". All code blocks contain literal text/code.

**3. Type consistency:**
- `subtitle` key used identically in: schema, SLOTS, TEXT_SLOTS Pick union, FIELDS Pick union, test config literals.
- y-coordinates match the spec table exactly: subtitle=205, size=270, logo=330, price=670.
- font-size for subtitle = 40, matching spec.
- `fontStyle?: "italic"` literal type matches between SlotBox interface and the subtitle slot's `"italic" as const` value.
