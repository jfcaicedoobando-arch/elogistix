import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { FIELD_FOCUS_RING_COMPACT_CLASS } from "./field.tokens";

const Checkbox = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { ref?: React.Ref<React.ElementRef<typeof CheckboxPrimitive.Root>> }) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      FIELD_FOCUS_RING_COMPACT_CLASS,
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
