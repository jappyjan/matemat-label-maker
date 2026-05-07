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
