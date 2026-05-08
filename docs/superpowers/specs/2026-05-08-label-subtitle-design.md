# Label Subtitle Field — Design

## Goal

Add an optional `subtitle` field to the label generator. The subtitle renders directly under the title (`name`), centered, in italic, at a smaller font size than the title. It must follow the same fixed-font-size approach used by other fields (no dynamic resizing).

## Changes

### 1. Form (`src/_components/label-generator.tsx`)

Add `subtitle: ""` to the `placeholders` initial state. Insertion order matters — it controls the rendering order of the input fields. The field goes between `name` and `size`:

```ts
const [placeholders, setPlaceholders] = useState<Record<string, string>>({
  name: "",
  subtitle: "",
  size: "",
  price: "",
  footerLine1: "",
  footerLine2: "",
});
```

The existing render loop iterates over `Object.entries(placeholders)`, so no JSX changes are needed — the new input renders automatically.

### 2. SVG template (`public/label_template.svg`)

Insert a new `<text>` element for `{{subtitle}}` between the `name` and `size` elements, and shift the `size` element's baseline down to make room.

| Element | Before (y) | After (y) | Notes |
|---|---|---|---|
| name | 136.409 | 136.409 | unchanged, font-size 96 |
| **subtitle** | — | **200** | **new**, font-size 40, italic, centered |
| size | 216.773 | **265** | shifted down by ~48px |
| price | 537.773 | 537.773 | unchanged |
| footerLine1 | 693.773 | 693.773 | unchanged |
| footerLine2 | 774.773 | 774.773 | unchanged |

The new `<text>` element:

```xml
<text fill="white" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="40" font-style="italic" text-anchor="middle" letter-spacing="0em"><tspan x="315" y="200">{{subtitle}}</tspan></text>
```

- `text-anchor="middle"` + `x="315"` (half of the 630-wide canvas) centers horizontally.
- `font-style="italic"` triggers Inter Italic (installed in the og-image-generator Docker image).
- `font-size="40"` is smaller than the title's 96 and tuned to fit ~27 characters inside the canvas — verified against the long-subtitle test case "Extra strong caffeine boost".

## Verified behavior (production pipeline: real Docker og-image-generator + Inter)

1. **Normal subtitle ("Classic Refreshing")**: italic renders, centered, well-balanced under title.
2. **Long subtitle ("Extra strong caffeine boost", 27 chars)**: fits inside the 630px canvas — no overflow at 40pt.
3. **Empty subtitle**: layout shows extra whitespace between title and size. Accepted per user choice — no conditional rendering possible because the og-image-generator does plain `{{key}}` string substitution.

## Non-goals

- No dynamic shrink-to-fit for any field. All fields keep their fixed font-size (the existing convention).
- No changes to title, price, or footer positions.
- No changes to the og-image-generator service.
