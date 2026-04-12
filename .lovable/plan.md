

## Auditoría arquitectónica del codebase — Reporte

### Hallazgos ordenados por criticidad

---

#### 1. CRÍTICO — `calcularEstadoEmbarque` vive en un hook pero es lógica pura

`calcularEstadoEmbarque` en `src/hooks/useEmbarqueUtils.ts` es una función pura sin dependencias de React. Se importa en 6+ archivos (portal, dashboard, embarques). Debería estar en `src/lib/` (ej. `embarqueLogic.ts`), no en `hooks/`.

**Impacto**: Viola separación de concerns. Un hook file no debe exportar lógica de dominio pura.

---

#### 2. CRÍTICO — Mapeos visuales duplicados en `PortalEmbarques.tsx`

`getEstadoBorderColor`, `getModoCircleStyle` y `getModoLucideIcon` (~45 líneas) están definidos inline en el componente de página. Son mapeos UI reutilizables que pertenecen a `src/lib/uiMappings.ts`.

**Impacto**: Si se crean más vistas de portal, se duplicarán. Rompe la convención establecida en el proyecto.

---

#### 3. ALTO — `helpers.ts` es un proxy innecesario

`helpers.ts` contiene solo `formatDate` + `resolverContacto` y re-exporta `getEstadoColor`/`getModoIcon` desde `uiMappings.ts`. 18 archivos importan desde `helpers.ts` en lugar de directamente desde `uiMappings.ts` y `formatters.ts`.

**Recomendación**: Mover `formatDate` a `formatters.ts`, `resolverContacto` a un lugar más específico (o dejarlo en helpers), y que los 18 consumidores importen directamente de `uiMappings` y `formatters`. Eliminar helpers.ts o dejarlo como barrel mínimo.

---

#### 4. ALTO — Query keys del portal no usan la factoría centralizada

`usePortalData.ts` usa strings hardcodeados (`["portal", "embarques", ...]`) en lugar de `queryKeys`. Esto contradice la convención del proyecto y dificulta invalidaciones coordinadas.

**Recomendación**: Agregar un bloque `portal` a `queryKeys.ts`.

---

#### 5. ALTO — Tipo `any` en `EmbarqueCard`

`EmbarqueCard({ e }: { e: any })` en `PortalEmbarques.tsx`. Es el único uso de `any` en componentes (fuera de un cast en `useClienteFinancials`). Debería tiparse con el retorno de la query o un tipo derivado.

---

#### 6. MEDIO — `ESTADO_TIMELINE` y `ESTADOS_EMBARQUE` son idénticos

En `embarqueConstants.ts`, líneas 11-13: ambos arrays contienen exactamente los mismos 7 elementos. Uno debería eliminarse o derivarse del otro.

---

#### 7. MEDIO — `profitUtils.ts` re-exporta componentes React

`src/lib/profitUtils.ts` hace `export { ProfitBadge, RentabilidadGlobalBadge } from "@/components/shared/ProfitBadge"`. Un archivo en `lib/` no debería re-exportar componentes React. Esto es un vestigio de backward compatibility que ya debería haberse limpiado.

---

#### 8. MEDIO — `format(parseISO(...))` inline en el portal

En `PortalEmbarques.tsx`, `PortalEmbarqueDetalle.tsx` y `PortalDashboard.tsx` hay ~10 llamadas a `format(parseISO(date), "dd/MM/yy")` directas en vez de usar `formatDate` de helpers/formatters. Esto duplica la lógica de formateo y no maneja el caso de fecha nula de forma consistente.

---

#### 9. MEDIO — Backward-compat re-export files en `components/`

3 archivos raíz (`NuevoUsuarioDialog.tsx`, `NuevoProveedorDialog.tsx`, `EditarProveedorDialog.tsx`) solo re-exportan desde sus carpetas de dominio. Si ya no hay consumidores externos usando la ruta antigua, pueden eliminarse.

---

#### 10. BAJO — `EmbarqueCard` es un componente significativo inline en una página

El componente `EmbarqueCard` (~70 líneas) está definido dentro de `PortalEmbarques.tsx`. Debería extraerse a `src/components/portal/EmbarqueCard.tsx` siguiendo la convención de descomposición modular del proyecto.

---

#### 11. BAJO — Stale comment en `helpers.ts`

Línea 1: `// Shared helper functions extracted from mockData.ts` — referencia a un archivo que ya no existe.

---

### Plan de acción recomendado (en orden)

| Paso | Archivos | Esfuerzo |
|------|----------|----------|
| 1. Mover `calcularEstadoEmbarque` a `src/lib/embarqueLogic.ts`, re-exportar desde barrel | `useEmbarqueUtils.ts`, `useEmbarques.ts`, nuevo `embarqueLogic.ts` | Bajo |
| 2. Mover mapeos de portal (`getEstadoBorderColor`, `getModoCircleStyle`, `getModoLucideIcon`) a `uiMappings.ts` | `PortalEmbarques.tsx`, `uiMappings.ts` | Bajo |
| 3. Agregar query keys de portal a `queryKeys.ts` y actualizar `usePortalData.ts` | 2 archivos | Bajo |
| 4. Tipar `EmbarqueCard` prop eliminando `any` | `PortalEmbarques.tsx` | Bajo |
| 5. Consolidar `formatDate` en `formatters.ts`, limpiar `helpers.ts` | `formatters.ts`, `helpers.ts`, 18 consumidores | Medio |
| 6. Eliminar duplicado `ESTADO_TIMELINE` / `ESTADOS_EMBARQUE` | `embarqueConstants.ts`, consumidores | Bajo |
| 7. Eliminar re-export de componentes desde `profitUtils.ts` | `profitUtils.ts`, consumidores de ProfitBadge | Bajo |
| 8. Reemplazar `format(parseISO(...))` inline por `formatDate` en portal | 3 archivos portal | Bajo |
| 9. Extraer `EmbarqueCard` a `src/components/portal/EmbarqueCard.tsx` | `PortalEmbarques.tsx`, nuevo archivo | Bajo |
| 10. Verificar y eliminar backward-compat re-exports si no tienen consumidores | 3 archivos | Bajo |

### Resumen

La arquitectura está en **buen estado general** — hay separación clara entre hooks, lib, components y pages, con barrels y una factoría de query keys bien establecida. Los problemas encontrados son principalmente **deuda técnica incremental**: mapeos duplicados, un par de violaciones de la convención de separación lib/hooks/components, y strings hardcodeados en el portal que no siguen el patrón del resto de la app. Ninguno es un blocker funcional, pero limpiarlos ahora previene que se multipliquen.

