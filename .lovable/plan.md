# Auditoría arquitectónica del codebase — Reporte read-only

## Veredicto general

La arquitectura está **en muy buen estado**. Los pasos 1-11 ya pagaron casi toda la deuda técnica relevante:

- Capa `services/` aislada de React (sin hooks, sin toasts).
- Capa `lib/domain/` con lógica de negocio pura y testeada.
- Capa `lib/parsers/` separada del fetching (Dashboard, CotizacionDetalle).
- Hooks orquestadores delgados (controller hooks de los wizards).
- Query keys centralizados en `lib/queryKeys.ts`.
- Páginas casi puramente presentacionales (no hay `useEffect` con fetching imperativo, no hay `useQuery` inline en pages).
- Sin `as any`, sin `console.log` de debug, sin `cd` en scripts.
- 191/191 pruebas verdes.

Los hallazgos restantes son **refinamientos**, no problemas de fondo.

---

## Hallazgos priorizados

### CRÍTICO — Inexistente
No se detectaron problemas críticos: no hay lógica de negocio embebida en componentes UI, no hay imports de `supabase/client` en `pages/` ni en `components/`, y no hay duplicación de RLS.

### ALTO — Refinamientos de impacto medible

**A1. Inconsistencia de toasts: `useToast` (shadcn) vs `sonner`**
Coexisten dos sistemas de notificaciones:
- 40 archivos importan `@/hooks/use-toast`.
- 2 archivos importan `sonner` directamente (`useProformas.ts`, `useDescargarProformaPdf.ts`).

Cada librería tiene su propia API y estilo visual. El usuario percibe toasts distintos según el flujo. Hay que elegir uno y migrar el otro — preferentemente `useToast` porque es el predominante.

**A2. Hooks que aún tocan `supabase.from(...)` sin pasar por `services/`**
Quedan pequeños hooks que hablan directo con el cliente, saltándose la capa de servicios:
- `useUsuarios.ts` (membership query + edge function)
- `useUsuarioMutations.ts` (insert directo en `organization_members`)
- `useClientUsersMutations.ts` (delete directo en `client_users`)
- `useSidebarAlerts.ts`, `useRentabilidadClientes.ts`, `useProfitMaps.ts`, `useOperadoresDistintos.ts`, `useGlobalSearch.ts`, `usePortalDocumentDownload.ts`

Convención del repo: los hooks orquestan React Query + cache; los `services/` hacen el I/O. Estos hooks rompen la convención.

**A3. `usePortalData.ts` debe modularizarse igual que `embarqueServices`**
173 líneas con 9 queries distintas + 3 constantes de columnas inline (`PORTAL_EMBARQUE_DETAIL_COLUMNS`, `PORTAL_EVENTO_COLUMNS`, `PORTAL_DOCUMENTO_COLUMNS`). Mismo patrón que ya se aplicó a embarques: extraer a `services/portal/{queries,columns}.ts` y dejar el hook como capa de cache.

### MEDIO — Higiene y consistencia

**M1. Componentes UI grandes en `facturacion/`**
- `TabProformas.tsx` (270 líneas) y `TabProformasPendientes.tsx` (246 líneas) mezclan: estado de filtros, paginación, selección, definición de columnas inline (con badges hardcodeados) y render de la tabla. Patrón clásico para extraer:
  - `useTabProformas()` → hook con filtros, paginación, conteos.
  - `proformasColumns.tsx` → definición de columnas.
  - El componente queda solo con el JSX y los handlers de UI.

**M2. `DialogGenerarProforma.tsx` (237 líneas)**
Mismo patrón. Ya tiene un controller hook parcial (`useProformaDialog`), pero la lógica de estados internos del diálogo (selección de conceptos, overrides de IVA, totales calculados) sigue dentro del componente. Extraer todo a `useDialogGenerarProformaState()`.

**M3. `useNuevoEmbarqueWizard.ts` (336 líneas) — el más grande del repo**
Aunque ya está extraído de la página, el hook absorbió mucha responsabilidad:
1. Hidratación desde cotización (lógica pura: parsing y mapeo).
2. Manejo de modo expediente (nuevo vs existente).
3. Validación step 1 (lógica pura).
4. Auto-pre-vinculación desde otra ruta.
5. Orquestación del submit (5 mutaciones encadenadas).

Las piezas (1) y (3) son funciones puras y deberían estar en `lib/domain/embarque.ts` (o un nuevo `lib/domain/nuevoEmbarque.ts`) con tests unitarios. La (5) puede vivir en un service orquestador (`services/embarque/crearEmbarqueFlow.ts`) que el hook solo invoca.

**M4. `useEmbarques.ts` y barrels que reexportan demasiado**
`useEmbarques.ts` reexporta 11 nombres de queries + 9 mutations + tipos. Es cómodo, pero esconde cuáles archivos consumen qué. Los nuevos consumidores deberían importar directamente desde `hooks/embarque/useEmbarqueQueries` o `useEmbarqueMutations`. El barrel se mantiene solo por compatibilidad.

**M5. Colores hardcoded fuera del design system**
Aunque la convención dice "siempre tokens semánticos", encontré `bg-blue-100`, `text-blue-800`, `bg-red-*`, `bg-green-*` en 15 archivos UI (mayoría son badges de estado en `TabProformas`, `OperacionesWidgets`, `DashboardStatusCards`, `TablaCostosLocal`, etc.). Centralizar como variantes en `index.css` (`--badge-info`, `--badge-warning`, `--badge-success`) o definir un componente `<StatusBadge variant="…" />` que mapee internamente.

### BAJO — Opcional / cosmético

**B1. Reorganizar `lib/` por categoría**
11 archivos sueltos en `src/lib/`. Una jerarquía más navegable:
```text
lib/
  formatters/   (formatters.ts, financialUtils.ts, profitUtils.ts, costosUSD.ts)
  storage/      (storageUtils.ts)
  config/       (estadoConfig.ts, uiMappings.ts)
  utils/        (utils.ts, errorUtils.ts, contactoUtils.ts)
  queryKeys.ts
  domain/, mappers/, parsers/  (ya existen)
```
Cero cambio funcional, pero reduce ruido visual.

**B2. Tests de dominio puro faltantes**
- `lib/domain/configuracion.ts` (16 líneas): sin tests; trivial pero merece una prueba para mantener la convención.
- Si se extraen `validateStep1` e hidratación (M3), añadir suite.

**B3. `useConfiguracionState.ts` (110 líneas)**
No revisado en esta auditoría; vale mirarlo en caso de tener lógica de negocio embebida.

**B4. Desuso del refetch manual**
`Usuarios.tsx` usa `refetch` del hook directamente; el resto del repo confía en invalidaciones de cache desde mutations. Inconsistencia menor — quitar el `refetch` y dejar que `useUpdateUserRole`/`useDeleteUser` invaliden `queryKeys.usuarios.all` (ya lo hacen).

---

## Plan recomendado (orden de ejecución)

| # | Tarea | Categoría | Esfuerzo |
|---|-------|-----------|----------|
| 1 | Unificar sistema de toasts: migrar los 2 hooks de `sonner` → `useToast` (o decidir lo contrario y migrar 40 archivos — preferible la primera). | A1 | XS |
| 2 | Mover los hooks que aún hacen `supabase.from(...)` a llamar `services/` (crear `userService`, `clientUserService`, `sidebarAlertsService`, etc. cuando no existan). | A2 | M |
| 3 | Modularizar `usePortalData.ts` → `services/portal/{queries,columns}.ts` siguiendo el patrón de `embarqueServices`. | A3 | S |
| 4 | Extraer columnas + controller hook de `TabProformas` y `TabProformasPendientes`. | M1 | M |
| 5 | Extraer estado interno del `DialogGenerarProforma` a un controller hook (`useDialogGenerarProformaState`). | M2 | S |
| 6 | Adelgazar `useNuevoEmbarqueWizard`: mover hidratación + validación a `lib/domain/nuevoEmbarque.ts` con tests, mover orquestación del submit a `services/embarque/crearEmbarqueFlow.ts`. | M3 | M |
| 7 | Auditar `useConfiguracionState.ts` (110 líneas) y aplicar el mismo patrón si hay lógica embebida. | B3 | S |
| 8 | Reemplazar colores hardcoded `bg-blue-*`, `text-red-*`, etc. por tokens semánticos o un `<StatusBadge>` reutilizable. | M5 | M |
| 9 | Eliminar `refetch` manual en `Usuarios.tsx` y confiar en invalidaciones. | B4 | XS |
| 10 | Reorganizar `src/lib/` por categoría (`formatters/`, `storage/`, `config/`, `utils/`). | B1 | S (mecánico) |
| 11 | Añadir tests para `lib/domain/configuracion.ts` y nuevos puros extraídos. | B2 | XS |

## Resumen ejecutivo

- **Critical issues: 0.**
- **High-impact (A1-A3):** consistencia de toasts, hooks que aún saltan la capa de servicios, modularización de `usePortalData`. Son ~1-2 horas total.
- **Medium (M1-M5):** componentes/hook grandes restantes y colores hardcoded. Es la parte más voluminosa (~1 día) pero ninguno bloquea features.
- **Low (B1-B4):** organización visual de `lib/`, tests de cobertura, limpieza menor.

Recomiendo ejecutar en orden numérico — los pasos 1-3 son las únicas mejoras estructurales que aún quedan; del 4 en adelante son refinamientos progresivos que pueden intercalarse con trabajo de producto sin urgencia.
