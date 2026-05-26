import { useMutation } from "@tanstack/react-query";
import { invokeJsonCargoBolLookup, type BolLookupResponse } from "@/services/embarque";

export type { BolLookupResponse };

export function useJsonCargoBolLookup() {
  return useMutation({
    mutationFn: (embarqueId: string) => invokeJsonCargoBolLookup(embarqueId),
  });
}
