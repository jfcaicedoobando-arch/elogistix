/**
 * Alias histórico de `useDebouncedValue`. Se conserva para no romper los ~12
 * call-sites que importan `useDebounce` desde `@/hooks/shared`. La lógica vive
 * ahora en `@/lib/hooks/useDebouncedValue`.
 */
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export const useDebounce = useDebouncedValue;
