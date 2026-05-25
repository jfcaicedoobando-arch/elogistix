/**
 * Versión actual de la app — string literal para evitar arrastrar el bundle
 * completo del changelog (chunk0, ~66 KB) en el shell autenticado.
 *
 * IMPORTANTE: Mantener sincronizada con la entrada más reciente de
 * `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.
 * El script `npm run changelog:add` lo actualiza automáticamente.
 */
export const APP_VERSION = "11.3.0";
