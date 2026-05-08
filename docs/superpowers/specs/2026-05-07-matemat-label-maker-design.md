# Matemat Label Maker — Design

## Goal

Finish the matemat label maker so users can create, save, edit, and download fridge labels matching the reference style (e.g. Fritz-Kola: name + size on one side, logo in the middle, price on the other side, two-line nutrition footer). The current PoC has hardcoded fields, no persistence, no logo support, and a static SVG template with fixed text positions.

## Non-goals

- User accounts / multi-tenancy (single-tenant per deployment)
- Free-form canvas editing (drag-and-drop slots)
- Per-slot text alignment configuration (alignments are baked into the layout)
- PDF export

## Architecture

### Stack additions

- **Drizzle ORM + better-sqlite3** — single SQLite file at `/data/matemat.db`, mounted as a Docker volume so data survives container rebuilds.
- **Local disk** for logo uploads at `/data/uploads/logos/` (same volume).
- **No app-level auth** — single-tenant. The og-image-generator's basic auth stays unchanged.
- **Pages router** — keep consistent with existing code. No App Router migration.

### Rendering pipeline

The static template + `{{placeholder}}` substitution is replaced by dynamic SVG generation:

1. Editor state is auto-saved to a draft (`PUT /api/drafts/<id>`) on debounce.
2. Live preview: `<img src="/api/matemat-label?id=<id>&kind=draft|saved">` →
   - Server loads the config from SQLite,
   - Generates a complete SVG via `renderLabelSvg(config, logoData)`,
   - Forwards the SVG URL (`/api/labels/<id>/svg?kind=…`) to the og-image-generator,
   - Returns the resulting PNG.
3. **Save** promotes a draft to a saved label: insert into `labels`, delete the draft. After promotion, subsequent edits go directly to the saved label (no intermediate draft).
4. **Download** endpoints:
   - `GET /api/labels/<id>/download.png?scale=1|2|4&rotate=0|90` — rasterized via og-image-generator
   - `GET /api/labels/<id>/download.svg?rotate=0|90` — generated SVG returned directly
5. **Batch download:** `GET /api/labels/batch-download?ids=…&format=png|svg&scale=…&rotate=…` returns a zip.

The og-image-generator becomes "dumb" — it only rasterizes the SVG URL we hand it. All layout logic lives in this app.

### Why dynamic SVG

- Per-text alignment, color, optional logo, variable text length, and download-time rotation can all be expressed by the same `LabelConfig` → SVG function.
- Auto font-shrink for long text needs server-side measurement of the text against slot width; that's only practical if we control SVG generation.
- One source of truth (the config) for both PNG and SVG downloads — no template drift.

## Data model

```
logos
  id            text PRIMARY KEY (uuid)
  filename      text         -- original filename for display
  storage_path  text         -- relative path under /data/uploads/logos/
  mime_type     text         -- image/svg+xml, image/png, image/jpeg, …
  recolorable   boolean      -- true only for SVG (auto-detected on upload)
  created_at    integer      -- unix ms

labels                       -- saved labels
  id            text PRIMARY KEY
  name          text         -- gallery display name (defaults to LabelConfig.name)
  config        text (JSON)  -- LabelConfig
  created_at    integer
  updated_at    integer

drafts                       -- in-progress NEW labels only (auto-saved)
  id            text PRIMARY KEY
  config        text (JSON)
  updated_at    integer
```

### LabelConfig

The single source of truth for rendering:

```ts
type LabelConfig = {
  name: string;          // top
  size: string;          // below name
  price: string;         // below logo
  footerLine1: string;
  footerLine2: string;
  logoId: string | null; // -> logos.id; null = no logo (logo slot stays empty)
  colors: {
    background: string;  // hex, e.g. "#000000"
    foreground: string;  // hex, applied to all text + recolorable SVG logos
  };
};
```

Slots have **fixed alignment** baked into the layout (matches the existing template's geometry):

- **name** — left-aligned, default 96px
- **size** — left-aligned, default 42px, below name
- **logo** — centered in middle bounding box, scaled to fit preserving aspect
- **price** — left-aligned, default 42px, below logo
- **footerLine1** — left-aligned, default 42px, near bottom
- **footerLine2** — left-aligned, default 42px, bottom

Auto font-shrinking handles overflow per slot (see below). One global foreground color is used for all text and (when applicable) the recolorable SVG logo's `fill`.

## SVG generation + auto font-shrink

A pure function lives at `src/server/label/render.ts`:

```ts
renderLabelSvg(config: LabelConfig, logo: LoadedLogo | null): string
```

where `LoadedLogo` carries the file's mime type, raw bytes, and (for SVG) the parsed SVG content as a string.

### Algorithm

1. Build SVG with fixed `viewBox="0 0 630 800"` and `<rect width="630" height="800" fill={background}>`.
2. For each text slot:
   - Compute the available width from the slot's bounding box.
   - Default font size from the existing template (96 for name, 42 for the rest).
   - Call `fitFontSize(text, maxWidth, defaultSize, minSize=24)` — uses a precomputed average glyph-width-per-em table for Inter to estimate the largest font size that fits. Falls back to the minimum size if even that overflows.
   - Emit `<text font-family="Inter" font-size={fitted} fill={foreground}>` with `textLength` and `lengthAdjust="spacingAndGlyphs"` as a safety net so the rasterizer can never overflow even if our approximation is slightly off.
3. **Logo** (if `logoId` is set):
   - Recolorable SVG: inline the SVG content, override `fill` to `foreground` on all paths/shapes, position inside the centered logo bounding box scaled to fit.
   - Non-recolorable (PNG/JPEG/non-recolorable SVG): embed as `<image href="data:{mime};base64,…" preserveAspectRatio="xMidYMid meet">` inside the logo bounding box.
4. The whole SVG is returned as a string.

### Slot bounding boxes

Derived from the existing template positions (630×800 canvas):

- name: x=120, y=40 → 510 wide, 120 tall
- size: x=245, y=180 → 380 wide, 60 tall
- logo: x=120, y=260 → 390 wide, 240 tall (centered)
- price: x=235, y=510 → 380 wide, 60 tall
- footerLine1: x=170, y=660 → 450 wide, 60 tall
- footerLine2: x=170, y=740 → 450 wide, 60 tall

(Exact values to be tuned during implementation against the reference photo, but these are the starting bounds.)

### SVG endpoint

`GET /api/labels/<id>/svg?kind=draft|saved&rotate=0|90`

- Loads config from `drafts` or `labels`
- Loads logo file from disk if `logoId` is set
- Calls `renderLabelSvg`
- Wraps in a 90° rotation transform if `rotate=90` (swaps viewBox dimensions)
- Returns `Content-Type: image/svg+xml`

This endpoint is what the og-image-generator fetches.

## API surface

```
# Drafts (auto-save)
POST   /api/drafts                    -> { id }                # create empty draft
GET    /api/drafts/<id>               -> LabelConfig
PUT    /api/drafts/<id>               -> { ok: true }          # body: LabelConfig
DELETE /api/drafts/<id>
GET    /api/drafts                    -> Draft[]               # for gallery

# Saved labels
POST   /api/labels                    -> { id }                # body: { draftId, name } — promotes a draft
GET    /api/labels                    -> Label[]               # for gallery
GET    /api/labels/<id>               -> Label
PUT    /api/labels/<id>               -> { ok: true }          # update name or config
DELETE /api/labels/<id>

# SVG / PNG (consumed by <img> in editor and by og-image-generator)
GET    /api/labels/<id>/svg?kind=draft|saved&rotate=0|90       -> image/svg+xml
GET    /api/matemat-label?id=<id>&kind=draft|saved&rotate=…    -> image/png   (existing route, repurposed)

# Downloads
GET    /api/labels/<id>/download.png?scale=1|2|4&rotate=0|90   -> attachment
GET    /api/labels/<id>/download.svg?rotate=0|90               -> attachment
GET    /api/labels/batch-download?ids=…&format=…&scale=…&rotate=…
                                                               -> application/zip

# Logos
POST   /api/logos                     -> Logo                  # multipart upload
GET    /api/logos                     -> Logo[]
GET    /api/logos/<id>/file           -> the raw file (used internally; not by editor)
PUT    /api/logos/<id>                -> { ok: true }          # rename
DELETE /api/logos/<id>                -> { ok: true }          # 409 if in use unless ?force=true
```

`POST /api/logos` accepts SVG, PNG, JPEG. SVG is detected and marked `recolorable=true`; PNG and JPEG are stored as-is and `recolorable=false`. File size limit: 10 MB. Filename for `storage_path`: `<uuid>.<ext>`.

## UI

### Pages

```
/                       Gallery — drafts + saved sections, "+ New label", "Logos" link
/edit/draft/[id]        Editor for an in-progress new label
/edit/label/[id]        Editor for a saved label (edits auto-save in place)
/logos                  Logo library
```

When **Save** is clicked in the draft editor, the server creates a label and the page navigates to `/edit/label/<newId>` (replacing history so Back doesn't return to the deleted draft).

### Visual style

- Dark theme: `zinc-950` background, `zinc-900` cards, white text, single accent color (e.g. indigo) for primary actions. Replaces the existing purple gradient.
- Inter font everywhere (matches the rendered labels).
- Card-based layout, generous whitespace, rounded corners (`rounded-xl`).

### Component dependencies

- `@radix-ui/react-dialog` — logo picker, confirm-delete dialogs
- `@radix-ui/react-popover` — color picker, download options popover
- `react-colorful` — hex/HSV color picker
- `lucide-react` — icons
- `react-dropzone` — logo upload drag-and-drop
- `nanoid` — id generation

### Gallery (`/`)

- Header: app title, "Logos" link, "+ New label" button (creates a draft, redirects to `/edit/[draftId]`)
- **Drafts section:** horizontal-scroll row of small thumbnails (uses `/api/matemat-label?...&kind=draft`), each with auto-saved timestamp and a delete button. Empty state: "No drafts yet."
- **Saved labels section:** responsive grid of larger thumbnails. Each card: thumbnail, name, action menu (edit / duplicate / delete), multi-select checkbox. Empty state: "No saved labels yet."
- Floating toolbar when 1+ saved labels are selected: "Download selected" → opens download popover (format, scale, rotate) → triggers batch endpoint, browser downloads a zip.

### Editor (`/edit/[id]`)

Two-pane, sticky preview on the left, scrolling controls on the right.

- **Header:** breadcrumb-style label name input (auto-saves; placeholder "Untitled label"). Status pill: "Draft · Saved 2s ago" or "Saved" once promoted. Buttons: "Save" (only shown for drafts), "Download" (popover), "Back to gallery".
- **Left pane (60%):** live preview centered on a checkerboard background indicating label bounds. Zoom toggle (fit / 100%) below the preview.
- **Right pane (40%):** scrollable, with three sections:
  - **Text:** 5 text fields (Name, Size, Price, Footer line 1, Footer line 2). Each shows a small italic note "auto-shrunk to fit" below the field when `fitFontSize` returned less than the default.
  - **Colors:** two color swatches (Background, Foreground). Click → `react-colorful` popover with hex input. Small palette of presets (black, white, plus a few common bottle colors) for quick selection.
  - **Logo:** current logo thumbnail or empty state ("No logo"). "Choose logo" button opens a Radix dialog containing the logo library (grid of thumbnails, "Upload new" drop zone, "No logo" option). Selecting closes the dialog and updates the config.
- **Auto-save:** debounced 500ms. For drafts, PUTs to `/api/drafts/<id>`; for saved labels, PUTs to `/api/labels/<id>`. Status updates in header. The editor distinguishes the two via the URL kind, set when the page is loaded.

### Logos page (`/logos`)

- Drag-drop upload zone at the top, also clickable for file picker
- Grid of logos: thumbnail, filename, "Recolorable" badge for SVGs, "Used by N labels" indicator, rename + delete buttons
- Delete confirmation dialog warns if the logo is in use; force-delete option clears `logoId` on those labels

## File layout (new files)

```
src/
  server/
    db/
      client.ts                  # better-sqlite3 + drizzle init
      schema.ts                  # drizzle table definitions
      migrate.ts                 # runs migrations on boot
    label/
      render.ts                  # renderLabelSvg
      fit-font.ts                # fitFontSize + Inter glyph-width table
      slots.ts                   # slot bounding boxes (constants)
    logos/
      storage.ts                 # disk read/write helpers
      detect-recolorable.ts      # mime-based SVG detection
  pages/
    index.tsx                    # gallery (rewritten)
    edit/
      draft/[id].tsx             # editor for drafts
      label/[id].tsx             # editor for saved labels
    logos.tsx                    # logo library
    api/
      drafts/...                 # CRUD
      labels/
        index.ts
        [id]/
          index.ts
          svg.ts
          download.png.ts
          download.svg.ts
        batch-download.ts
      logos/
        index.ts                 # GET list, POST upload
        [id]/
          index.ts                # PUT rename, DELETE
          file.ts                 # GET raw bytes (internal)
      matemat-label/
        index.ts                  # repurposed: id-based, calls og-image-generator with /api/labels/<id>/svg
  _components/
    gallery/
      label-card.tsx
      draft-card.tsx
      batch-toolbar.tsx
    editor/
      preview.tsx
      text-section.tsx
      color-section.tsx
      logo-section.tsx
      logo-picker-dialog.tsx
      download-popover.tsx
    ui/                           # tailwind primitives wrapping radix
      button.tsx
      dialog.tsx
      popover.tsx
      color-picker.tsx
drizzle/
  0000_init.sql                   # initial migration
```

## Deployment changes

- Mount a volume `/data` in the matemat container (compose: `volumes: ["matemat-data:/data"]`)
- Set `DATABASE_PATH=/data/matemat.db` and `UPLOADS_DIR=/data/uploads` env vars
- Migrations run on container boot via the `migrate.ts` script invoked from `npm run start`
- The og-image-generator URL it fetches changes from `/${svgTemplateFileName}` to `/api/labels/<id>/svg?kind=…` (still hits `http://matemat:3000` internally on the docker network)
- Old `public/label_template.svg` becomes unused; deleted along with the old `{{placeholder}}` query-param contract

## Error handling

- **SQLite write error / disk full:** API returns 500 with `{ error: "storage" }`; UI surfaces a non-blocking toast and keeps editor state in memory.
- **Unsupported logo upload:** 415 with `{ error: "unsupported_format" }`.
- **Logo over 2 MB:** 413.
- **Render fails (e.g. malformed SVG logo):** the SVG endpoint returns a fallback "render error" SVG with the error message, so the editor preview shows the problem rather than a broken image.
- **og-image-generator unreachable:** `/api/matemat-label` returns 502; UI shows a toast and the SVG-formatted preview as a fallback (browser renders SVG natively, so the user can still see roughly what they're building).
- **Batch download with non-existent ids:** skip missing ids silently; if all are missing, return 404.

## Testing strategy

- **Unit tests** for `renderLabelSvg`, `fitFontSize`, `detect-recolorable`, slot geometry — pure functions, easy to cover.
- **Snapshot tests** for `renderLabelSvg` covering: minimal config, all fields filled, very long text (forces shrinking), recolorable SVG logo, PNG logo, no logo, custom colors.
- **API integration tests** (using a temp SQLite file) for: draft CRUD, label promote, logo upload + delete-with-in-use guard, batch-download zip contents.
- **Manual UI verification** for the editor flows: create draft → edit → save → download → re-edit; logo upload + recolor; batch download.

## Open questions / explicit deferrals

- **Per-slot foreground colors** — deferred. Current spec uses one global foreground for simplicity; can be added later by extending `LabelConfig.colors` without breaking existing data.
- **Custom slot bounds / layouts** — deferred (would require a layout config and template selector).
- **Auth** — deferred. Single-tenant assumption holds for now; revisit if multi-user becomes a need.
