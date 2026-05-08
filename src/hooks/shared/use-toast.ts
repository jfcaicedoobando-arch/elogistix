/**
 * Re-export de `useToast`/`toast` desde su ubicación histórica
 * (`src/hooks/use-toast.ts`). Permite consumirlo vía el barrel
 * `@/hooks/shared` y mantiene compatibilidad con imports legados.
 */
export { useToast, toast } from "@/hooks/use-toast";
