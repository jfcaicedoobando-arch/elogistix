# Plan: Limpieza de los 39 warnings del linter

Objetivo: dejar `bun run lint` en **0 warnings** sin cambiar comportamiento ni UI. Se trabajará en 4 tandas priorizadas por riesgo/esfuerzo, con corrida de tests + lint tras cada tanda.

---

## Tanda 1 — Quick wins (5 warnings, riesgo casi nulo)

Eliminar directivas `eslint-disable` que ya no aplican y separar constantes de componentes para que Fast Refresh funcione.

1. **Eliminar `// eslint-disable-next-line no-console` huérfanos**
   - `src/contexts/auth/useAuthProfile.ts:51`
   - `src/contexts/auth/useAuthSession.ts:64`
   - `src/pdf/render/__tests__/pdfRenderLeak.test.tsx:89`

2. **Fast refresh — extraer no-componentes a archivos hermanos**
   - `src/components/profit/EstadoResultadosTable.tsx` → mover constantes/helpers (líneas 4, 9, 101, 110) a `EstadoResultadosTable.helpers.ts`.
   - `src/test/mocks/reactPdfStub.tsx` → mover los exports no-componentes (líneas 46, 51, 60) a `reactPdfStub.helpers.ts` (es mock de tests, no afecta runtime).

---

## Tanda 2 — React Hooks deps (4 warnings)

Arreglar dependencias faltantes en `useMemo` / `useCallback` sin introducir re-render loops. Patrón: si `filtros` es un objeto que ya viene memoizado upstream, añadirlo al array; si no, memoizarlo en el llamador o desestructurar las llaves usadas.

1. `src/hooks/comisiones/useComisionesDevengadas.ts:15` — añadir `filtros` al deps de `useMemo`.
2. `src/hooks/cxp/useFacturasCxP.ts:12` — idem.
3. `src/hooks/facturacion/useCobranza.ts:17` — idem.
4. `src/components/cotizacion/CotizacionWizardLayout.tsx:49` — incluir `w` en el deps del `useCallback` (o capturar `w` vía ref si causa loop).

Verificación: además de lint, correr los tests de esos hooks (`bun run test:shard`) para asegurar que no se rompen referencias.

---

## Tanda 3 — Reducción de complejidad ciclomática (20 warnings)

Patrón general: extraer ramas a helpers puros o subcomponentes, sin mover lógica de negocio entre capas. Cada archivo baja de su complejidad actual a ≤16.

### Componentes UI (extraer subcomponentes / helpers de render)
- `src/components/cotizacion/SeccionRutaCotizacion.tsx` (20)
- `src/features/costeo/components/BuscarTarifaDialog.tsx` (20)
- `src/features/costeo/components/TarifaForm.tsx` (36) ← el más alto, requiere dividir en `TarifaFormHeader`, `TarifaFormMontos`, `TarifaFormVigencia`.
- `src/features/embarques/components/StepCostosPrecios.tsx` (18)
- `src/features/embarques/components/TabTracking.tsx` (21)
- `src/features/embarques/components/tracking/TrackingNavieraActions.tsx` (23)
- `src/pages/cxp/Cxp.tsx` (20)
- `src/pages/portal/PortalCotizacionDetalle.tsx` (17)

### Hooks / lógica de dominio (extraer helpers puros)
- `src/hooks/cxp/useNuevaFacturaProveedorForm.ts:132` (23)
- `src/lib/csv/importSchemaProveedor.ts:101` (18)
- `src/lib/csv/parseCsv.ts:115` (23)
- `src/lib/domain/estadoResultados.ts:99` (22)
- `src/lib/import/bbva.ts:91` (21)
- `src/services/embarques/dependenciasFinancieras.ts:31` (22)
- `src/services/profit/estadoResultadosDevengado.ts:53` (29)
- `src/test/setup.ts:39` (19) — refactor del mock global, sin afectar contrato.

### Edge functions (Deno)
- `supabase/functions/cxc-recordatorios/index.ts:35` (18)
- `supabase/functions/parse-cfdi-xml/index.ts:21` (18) — extraer la tabla de palabras-clave a un map.
- `supabase/functions/user-management/handlers.ts:232` `handleInviteClient` (21).

Verificación: tras cada archivo, `bun run lint <archivo>` + tests relacionados.

---

## Tanda 4 — Archivos / funciones demasiado largas (3 warnings, 5 hallazgos)

1. **`supabase/functions/process-email-queue/index.ts`** (294 líneas, función de 230 líneas, complejidad 56, anidamiento 5)
   - Dividir en módulos hermanos: `queueFetcher.ts`, `emailRenderer.ts`, `emailSender.ts`, `index.ts` (orquestador ≤100 líneas).
   - Cada `for` profundo se convierte en función helper, eliminando los `max-depth`.

2. **`supabase/functions/user-management/handlers.ts`** (344 líneas)
   - Separar en `handlers/invite.ts`, `handlers/update.ts`, `handlers/delete.ts`; reexportar desde `handlers.ts` o cambiar `index.ts` para importar directo.

---

## Cierre

- Correr `bun run lint` (esperado: 0/0), `bun run test:shard`, `bun run audit:all`.
- Bump `APP_VERSION` → `12.76.4`.
- Añadir entrada `[12.76.4]` en `CHANGELOG.md` con resumen: "Linter limpio (0 warnings): hooks deps, complejidad ≤16, archivos ≤250 líneas".

## Detalles técnicos

- No se cambia ninguna firma pública ni comportamiento observable.
- Los subcomponentes nuevos viven junto al archivo original (`./<Componente>/Parts/...`) salvo en `features/embarques`, donde ya existe convención `components/<feature>/`.
- Las edge functions mantienen el mismo endpoint y payload; sólo cambia la organización interna.
- Para los hooks con `filtros` faltante, se documenta en comentario por qué se incluye (estabilidad referencial garantizada por el caller con `useMemo`).

¿Procedo con las 4 tandas en orden, commiteando tras cada una, o prefieres que ejecute sólo algunas (p.ej. sólo Tandas 1+2 que son las más seguras)?
