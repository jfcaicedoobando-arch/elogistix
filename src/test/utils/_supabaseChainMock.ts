/**
 * @deprecated Re-export desde la fuente canónica (13.85.3).
 *
 * Conservado para no romper imports legacy `@/test/utils/_supabaseChainMock`.
 * La implementación vive en `src/services/__tests__/_supabaseChainMock.ts`.
 */
export {
  createSupabaseMock,
  createSupabaseChainMock,
  type QueryResult,
  type TableCall,
} from "@/services/__tests__/_supabaseChainMock";
