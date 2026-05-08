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
