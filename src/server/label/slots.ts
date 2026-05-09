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
