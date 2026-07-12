import * as React from "react";

import { cn } from "@/lib/utils";

const Input = ({ ref, className, type, ...props }: React.ComponentProps<"input"> & { ref?: React.Ref<HTMLInputElement> }) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  };
Input.displayName = "Input";

export { Input };
