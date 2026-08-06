import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { FIELD_FOCUS_RING_COMPACT_CLASS } from "./field.tokens";

const Switch = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { ref?: React.Ref<React.ElementRef<typeof SwitchPrimitives.Root>> }) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      FIELD_FOCUS_RING_COMPACT_CLASS,
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
);
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
