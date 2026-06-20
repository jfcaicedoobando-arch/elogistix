/**
 * @deprecated Re-export desde la fuente canónica (13.85.3).
 *
 * Conservado para no romper imports legacy `@/test/utils/_supabaseChainMock`.
 * La implementación vive en `src/services/__tests__/_supabaseChainMock.ts`.
 */
// eslint-disable-next-line no-restricted-imports -- Helper de tests: re-export consciente de carpeta interna __tests__.
export {
  createSupabaseMock,
  createSupabaseChainMock,
  type QueryResult,
  type TableCall,
} from "@/services/__tests__/_supabaseChainMock";
