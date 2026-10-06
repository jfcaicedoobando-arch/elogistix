import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

interface Props extends Pick<ComponentProps<typeof Input>, "type" | "min" | "step" | "placeholder" | "className"> {
  "aria-label": string;
  value: string;
  onCommit: (value: string) => boolean;
}

/** Keep drafts inside the cell: changing TanStack's cell function remounts its input. */
export function GarantiaEditableInput({ value, onCommit, "aria-label": ariaLabel, ...props }: Props) {
  const [draft, setDraft] = useState<string>();
  return (
    <Input
      {...props}
      aria-label={ariaLabel}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== undefined && onCommit(draft)) setDraft(undefined);
      }}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    />
  );
}
