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
  name:        { x: 60,  y: 130, width: 510, height: 120, defaultFontSize: 96, align: "middle" },
  size:        { x: 60,  y: 200, width: 510, height: 60,  defaultFontSize: 42, align: "middle" },
  logo:        { x: 165, y: 260, width: 300, height: 220, defaultFontSize: 0  },
  price:       { x: 60,  y: 600, width: 510, height: 100, defaultFontSize: 88, align: "middle" },
  footerLine1: { x: 60,  y: 740, width: 510, height: 28,  defaultFontSize: 22 },
  footerLine2: { x: 60,  y: 772, width: 510, height: 28,  defaultFontSize: 22 },
} satisfies Record<string, SlotBox>;

export type SlotKey = keyof typeof SLOTS;
