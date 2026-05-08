# Label Subtitle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centered, italic, smaller-than-title `subtitle` field to the matemat label, rendered directly under the title and shifting the `size` baseline down to make room.

**Architecture:** Two file edits — one to the React form (`src/_components/label-generator.tsx`) to add `subtitle` to the placeholders state, and one to the SVG template (`public/label_template.svg`) to insert the subtitle `<text>` element and shift `size`. The og-image-generator service (Docker, runs unchanged) does plain `{{key}}` string substitution and Resvg rendering — no service changes needed.

**Tech Stack:** Next.js 14 + React 18 + TypeScript (form), SVG 1.1 (template), Inter font (rendered server-side via og-image-generator with Inter Italic).

**Spec:** `docs/superpowers/specs/2026-05-08-label-subtitle-design.md`

---

## File Structure

- **Modify** `src/_components/label-generator.tsx` — add `subtitle: ""` between `name` and `size` in placeholders state. The existing render loop iterates `Object.entries`, so no JSX changes are needed; the new input renders automatically.
- **Modify** `public/label_template.svg` — insert `<text>` element for `{{subtitle}}` between `name` and `size` lines, and change `size` element's `y` from `216.773` to `265`.

No new files. No tests added — this project has no test suite, and verification is via the production rendering pipeline (Docker + curl + visual inspection).

---

## Task 1: Add subtitle to form state

**Files:**
- Modify: `src/_components/label-generator.tsx:7-13`

- [ ] **Step 1: Add `subtitle: ""` to placeholders state, between `name` and `size`**

Open `src/_components/label-generator.tsx`. The current state initializer is:

```tsx
const [placeholders, setPlaceholders] = useState<Record<string, string>>({
  name: "",
  size: "",
  price: "",
  footerLine1: "",
  footerLine2: "",
});
```

Change it to:

```tsx
const [placeholders, setPlaceholders] = useState<Record<string, string>>({
  name: "",
  subtitle: "",
  size: "",
  price: "",
  footerLine1: "",
  footerLine2: "",
});
```

Insertion order matters: it determines the rendering order in the form because the JSX uses `Object.entries(placeholders).map(...)`.

- [ ] **Step 2: Verify type-checking and build still pass**

Run: `npm run lint`
Expected: no new errors. (Existing lint warnings unrelated to this change are fine.)

If lint passes but you want extra confidence:
Run: `npm run build`
Expected: Next.js build succeeds.

- [ ] **Step 3: Visually verify the new input field appears in the form**

Start the dev server: `npm run dev`
Open `http://localhost:3000` in a browser.
Expected: a new "subtitle" input row is visible between "name" and "size" in the form column. The input is empty by default.

Stop the dev server (Ctrl+C) once verified.

- [ ] **Step 4: Commit**

```bash
git add src/_components/label-generator.tsx
git commit -m "feat: add subtitle field to label form

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Add subtitle text element to SVG template, shift size baseline

**Files:**
- Modify: `public/label_template.svg`

- [ ] **Step 1: Edit the SVG template**

Open `public/label_template.svg`. The current file is:

```xml
<svg width="630" height="800" viewBox="0 0 630 800" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="630" height="800" fill="black"/>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="96" letter-spacing="0em"><tspan x="120.156" y="136.409">{{name}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="244.855" y="216.773">{{size}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="234.52" y="537.773">{{price}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="173.304" y="693.773">{{footerLine1}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="170.351" y="774.773">{{footerLine2}}</tspan></text>
</svg>
```

Make two changes:

**A.** Insert a new `<text>` line for `{{subtitle}}` immediately after the `{{name}}` line.
**B.** Change the `{{size}}` line's `y` value from `216.773` to `265`.

Final file should be:

```xml
<svg width="630" height="800" viewBox="0 0 630 800" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="630" height="800" fill="black"/>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="96" letter-spacing="0em"><tspan x="120.156" y="136.409">{{name}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="40" font-style="italic" text-anchor="middle" letter-spacing="0em"><tspan x="315" y="200">{{subtitle}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="244.855" y="265">{{size}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="234.52" y="537.773">{{price}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="173.304" y="693.773">{{footerLine1}}</tspan></text>
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="42" letter-spacing="0em"><tspan x="170.351" y="774.773">{{footerLine2}}</tspan></text>
</svg>
```

Specific attribute meanings on the new line:
- `font-size="40"` — smaller than title (96), tuned to fit ~27 chars in the 630px canvas
- `font-style="italic"` — triggers Inter Italic in the renderer (font installed in og-image-generator Docker image)
- `text-anchor="middle"` + `x="315"` — horizontal centering (315 = 630 / 2)
- `y="200"` — baseline 64px below the title's baseline (136.409); subtitle visible top is ~172, leaving ~17px of breathing room from title descenders

- [ ] **Step 2: Verify SVG is well-formed by serving it**

Start the dev server: `npm run dev`
Fetch the raw SVG: `curl -s http://localhost:3000/label_template.svg | head -10`
Expected: the modified XML, including the new subtitle line.

- [ ] **Step 3: Visually verify rendered output through the production pipeline**

The Docker test container and HTTP server from brainstorming should still be running. If not, restart them:

```bash
# (only if not already running)
docker run -d --name og-test --rm -p 3003:3003 \
  -e AUTH_USERS=matemat -e AUTH_USER_matemat_PASSWORD=testpass \
  t3code-17f56395-og-image-generator
cd /tmp && python3 -m http.server 8765 --bind 0.0.0.0 &
```

Copy the new template into `/tmp` so the host's HTTP server can serve it to the Docker container, then render three test variants:

```bash
cp public/label_template.svg /tmp/label_final.svg

# Substitute placeholders ahead of time and let resvg render the SVG.
# Three test cases: normal, long, empty subtitle.

# Normal
sed -e 's/{{name}}/Cola/' -e 's/{{subtitle}}/Classic Refreshing/' \
    -e 's/{{size}}/0,5L/' -e 's/{{price}}/1,50€/' \
    -e 's/{{footerLine1}}/incl. 0,25€ Pfand/' -e 's/{{footerLine2}}/Best vor: 12\/2026/' \
    /tmp/label_final.svg > /tmp/label_final_normal.svg

# Long
sed -e 's/{{name}}/Mate/' -e 's/{{subtitle}}/Extra strong caffeine boost/' \
    -e 's/{{size}}/0,5L/' -e 's/{{price}}/2,80€/' \
    -e 's/{{footerLine1}}/incl. 0,25€ Pfand/' -e 's/{{footerLine2}}/Best vor: 12\/2026/' \
    /tmp/label_final.svg > /tmp/label_final_long.svg

# Empty
sed -e 's/{{name}}/Cola/' -e 's/{{subtitle}}//' \
    -e 's/{{size}}/0,5L/' -e 's/{{price}}/1,50€/' \
    -e 's/{{footerLine1}}/incl. 0,25€ Pfand/' -e 's/{{footerLine2}}/Best vor: 12\/2026/' \
    /tmp/label_final.svg > /tmp/label_final_empty.svg

# Render through the og-image-generator (passes svgUrl, no placeholders, since we pre-substituted)
for variant in normal long empty; do
  curl -s -u matemat:testpass \
    -o "/tmp/prod_final_${variant}.png" \
    "http://localhost:3003/og-image.png?svgUrl=http://host.docker.internal:8765/label_final_${variant}.svg" \
    -w "${variant}: HTTP %{http_code}\n"
done
```

Open each `prod_final_*.png` and confirm:
- **normal**: subtitle is centered, italic, sits cleanly under "Cola", "0,5L" sits below at comfortable distance
- **long**: subtitle "Extra strong caffeine boost" fits within canvas (no clipping)
- **empty**: title and "0,5L" both visible with extra whitespace between (acceptable)

- [ ] **Step 4: Commit**

```bash
git add public/label_template.svg
git commit -m "feat: add subtitle text element to label SVG template

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: End-to-end verification through dev server

**Files:**
- No file changes; this task is a manual smoke test.

- [ ] **Step 1: Start the dev server with prod-like env**

Ensure `.env` (or environment variables) point the Next.js dev server at the local Docker og-image-generator. Required vars (per `src/pages/api/matemat-label/index.ts`):
- `NEXT_PUBLIC_GENERATOR_URL=http://localhost:3003/og-image.png`
- `NEXT_PUBLIC_GENERATOR_USER=matemat`
- `NEXT_PUBLIC_GENERATOR_PASS=testpass`
- `NEXT_PUBLIC_BASE_URL=http://host.docker.internal:3000` (so the og-image-generator container can reach the Next.js dev server to fetch the SVG template)

Start dev server: `npm run dev`

- [ ] **Step 2: Manually fill in the form and verify the rendered label**

Open `http://localhost:3000`. Fill in:
- name: `Cola`
- subtitle: `Classic Refreshing`
- size: `0,5L`
- price: `1,50€`
- footerLine1: `incl. 0,25€ Pfand`
- footerLine2: `Best vor: 12/2026`

Wait ~1s for the debounced URL update. The `<img>` should display a label with:
- "Cola" as title (top-left position, large)
- "Classic Refreshing" centered underneath in italic
- "0,5L" centered below the subtitle
- "1,50€" centered in the middle area
- footers at the bottom

- [ ] **Step 3: Test empty subtitle**

Clear the subtitle field. Wait for the debounce.
Expected: the rendered label still works; "0,5L" visible below the title with extra whitespace where the subtitle would be.

- [ ] **Step 4: Stop the dev server and clean up Docker**

Stop the dev server (Ctrl+C).

```bash
docker stop og-test
# Stop the python HTTP server background job (Ctrl+C in its terminal, or kill the process)
```

- [ ] **Step 5: Commit (if any cleanup files appeared)**

Check `git status`. If clean, no commit needed. If `out.png` or other artifacts appeared and should not be tracked, leave them — they're already in (or should be added to) `.gitignore`.

---

## Self-Review Checklist (already completed before saving)

- **Spec coverage**: All four spec sections (Form, SVG template, Verified behavior, Non-goals) are reflected in Tasks 1–3.
- **Placeholder scan**: No "TBD"/"TODO"/"figure out". All code blocks contain literal text/code.
- **Type consistency**: `subtitle` key is used identically in both the React state and the SVG `{{subtitle}}` placeholder. Position numbers match the spec exactly (y=200 for subtitle, y=265 for size).
- **No tests added**: project has no test suite; verification is manual via Docker pipeline + dev server, as documented in Tasks 2 and 3.
