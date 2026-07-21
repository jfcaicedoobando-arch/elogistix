import { cn } from "@/lib/utils";

export function fieldErrorProps(error?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    className: cn(error && "border-destructive"),
  };
}

export function numberInputProps(error?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    className: cn(
      error && "border-destructive",
      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    ),
  };
}
