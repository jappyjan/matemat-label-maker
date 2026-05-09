# Label Subtitle Field — Design (slots-based architecture)

## Goal

Add an optional `subtitle` text field to the matemat label that renders directly under the title (`name`), centered, in italic, at a smaller font-size than the title. Auto-shrink behavior matches the other text slots; longer subtitles emit a `textLength` safety net like the rest.

## Background

The previous attempt at this feature (`docs/superpowers/specs/2026-05-08-...`) targeted an older single-file SVG template and standalone form. That code was deleted in the editor rebuild. This spec re-targets the current slots-based renderer.

## Architecture changes

Five files, one new field, one new slot, one new rendering attribute.

### 1. `src/server/label/types.ts` — schema

Add a single line to `labelConfigSchema`:

```ts
subtitle: z.string().default(""),
```

Place it between `name` and `size` for readability. The `z.infer`-derived `LabelConfig` type will then require `subtitle: string`. Existing API request bodies that omit `subtitle` continue to work because `labelConfigSchema.parse(...)` fills the default.

### 2. `src/server/label/slots.ts` — slot system

Extend `SlotBox` with an optional `fontStyle`:

```ts
export interface SlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
  defaultFontSize: number;
  align?: Align;
  fontStyle?: "italic"; // optional; only italic is supported today
}
```

Subtitle is the first and currently only slot using it. The narrow `"italic"` literal type (rather than a generic string) signals intent and prevents typos.

Update `SLOTS`:

| Slot | Before | After |
|---|---|---|
| `name` | `y=130, h=120, fs=96, align=middle` | unchanged |
| **`subtitle`** | — | **`x=60, y=205, w=510, h=50, fs=40, align=middle, fontStyle="italic"`** (new) |
| `size` | `y=200, fs=42` | `y=270` (shifted +70) |
| `logo` | `y=260, h=220` | `y=330` (shifted +70) |
| `price` | `y=600, fs=88` | `y=670` (shifted +70) |
| `footerLine1` | `y=740, fs=22` | unchanged |
| `footerLine2` | `y=772, fs=22` | unchanged |

Side effect: the price→footer1 gap shrinks from ~100px to ~30px. Visual separation is still clear (verified via production-pipeline mockup).

### 3. `src/server/label/render.ts` — emitter

Add `subtitle` to `TEXT_SLOTS`:

```ts
{ key: "subtitle", field: "subtitle" },
```

Place it between `name` and `size` so the SVG output order matches visual order (does not affect rendering, but reads better in the emitted SVG).

In `renderTextSlot`, emit `font-style="italic"` when the slot has `fontStyle: "italic"`:

```ts
const styleAttr = slot.fontStyle ? ` font-style="${slot.fontStyle}"` : "";
return `<text font-family="Inter" font-size="${fontSize}" fill="${color}" text-anchor="${align}"${styleAttr}>...`;
```

Other behavior (auto-fit, `textLength` safety net, XML escaping) is shared and applies to subtitle without further changes.

**Note:** The glyph-widths table is for Inter Regular. Italic glyphs are slightly different but close enough that the auto-fit will be marginally conservative for italic text — no underflow risk, just a slightly earlier shrink threshold than ideal. Acceptable trade-off; not worth a separate italic glyph table.

### 4. `src/_components/editor/text-section.tsx` — form

Add subtitle to the `FIELDS` array:

```ts
{ key: "subtitle", label: "Subtitle", slot: "subtitle" },
```

Place it between `name` and `size` so the input order matches the visual order. The existing render loop picks up the auto-shrink warning automatically.

The `key` type union must include `"subtitle"`:

```ts
const FIELDS: Array<{
  key: keyof Pick<LabelConfig, "name" | "subtitle" | "size" | "price" | "footerLine1" | "footerLine2">;
  label: string;
  slot: keyof typeof SLOTS;
}> = [...];
```

The same `Pick`-based union appears in `render.ts`'s `TEXT_SLOTS` declaration and must be updated identically.

### 5. `tests/server/label/render.test.ts` — tests

Add `subtitle: ""` to `baseConfig` (typed as `LabelConfig`, so TypeScript will require it). Add three new tests:

- `emits italic text for the subtitle slot when subtitle is set` — assert `font-style="italic"` appears in the SVG when subtitle is non-empty, and does NOT appear for other slots.
- `omits subtitle text when subtitle is empty` — assert no `<text>` element contains `font-style="italic"` when subtitle is "".
- `subtitle uses centered alignment` — assert the subtitle's `text-anchor="middle"` and `tspan x` is at canvas center (315).

No new test file needed — extend the existing `render.test.ts`.

API test files (e.g., `tests/api/labels.test.ts`, `tests/api/drafts.test.ts`) construct LabelConfig as untyped HTTP request bodies. They can omit `subtitle` and still pass: `labelConfigSchema.parse(...)` fills the default at API boundaries. No changes needed.

## Verified behavior (production pipeline)

Mockups rendered through the real og-image-generator Docker container with Inter Italic:

| Variant | Result |
|---|---|
| Normal subtitle ("Classic Refreshing") | renders italic, centered, balanced under title |
| Long subtitle (51 chars at 40pt) | auto-compressed via `textLength="510" lengthAdjust="spacingAndGlyphs"` — fits without clipping |
| Empty subtitle | layout shows extra whitespace between title and size; price/logo positions identical to non-empty case (slot positions are static) |

## Non-goals

- No font-weight support (only `fontStyle: "italic"` is added). Bold can be added later by extending the SlotBox type.
- No font-family override per slot. Everything stays Inter.
- No conditional layout (e.g., collapsing the subtitle slot when empty). The slot positions are static; an empty subtitle leaves visible whitespace, matching how empty fields work elsewhere in the system.
- No glyph-width table for italic. Auto-fit uses the regular table, with a slight conservative bias for italic text.
- No migration. Existing label rows have a JSON-serialized `config` column without `subtitle`; `labelConfigSchema.parse(...)` on read fills the default.
