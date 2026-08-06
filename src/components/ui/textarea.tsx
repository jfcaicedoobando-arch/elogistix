import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD_STATE_CLASS, FIELD_SURFACE_CLASS } from "./field.tokens";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = ({ ref, className, ...props }: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) => {
  return (
    <textarea
      className={cn(
        "flex min-h-20 text-base md:text-sm",
        FIELD_SURFACE_CLASS,
        FIELD_STATE_CLASS,
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};
Textarea.displayName = "Textarea";

export { Textarea };
