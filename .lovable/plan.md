

# Auditoría de arquitectura — Libre Carga (post v8.36.0)

## Estado actual: muy saludable
La auditoría previa (v8.33–v8.36) ya cerró los problemas críticos. Hoy el código está en buena forma:

- ✅ **0 fugas de capa relevantes**: `supabase.from(...)` solo aparece en `Login.tsx` (auth, justificado)
- ✅ **Barrels 100% respetados**: ningún componente importa directamente de `useEmbarqueQueries`/`useCotizacionQueries`
- ✅ `src/data/` limpio: solo datasets puros (`changelog/`, `ports.ts`)
- ✅ Capas `services/`, `lib/`, `types/`, `constants/` bien separadas
- ✅ 139/139 tests pasando
- ✅ `ARCHITECTURE.md` formaliza el contrato

## Hallazgos restantes (todos menores)

### 🟡 Oportunidades de mejora moderadas

1. **`src/data/changelog/legacy.ts` (1,523 líneas)** — Es un dataset histórico cargado dinámicamente, así que no impacta el bundle inicial. Pero si crece más, conviene partirlo por año (`legacy-2024.ts`, `legacy-2023.ts`). **Esfuerzo XS, impacto bajo.**

2. **`src/data/changelogData.ts` (428 líneas)** — Acumula todas las entradas v8.x. Aplica el mismo patrón: cuando llegue a v9.x, mover v8.x a legacy. Por ahora ok.

3. **`src/components/operaciones/DesempenoOperadores.tsx` (290 líneas)** — Componente más pesado de UI. Probable mezcla de cálculos + render. Candidato a extraer lógica a `useDesempenoChartData` (que ya existe — verificar si se aprovecha al máximo).

4. **`src/components/cotizacion/conceptos/ConceptoRows.tsx` (238 líneas)** — Muchas filas + handlers inline. Candidato a partir en sub-componentes (`ConceptoRowVenta`, `ConceptoRowCosto`).

5. **`src/components/cliente/NuevoClienteDialog.tsx` (228 líneas)** — Wizard en un solo archivo. Si crece, partir steps en archivos separados como ya se hizo con embarque.

### 🟢 Observaciones (no requieren acción)

6. **22 hooks `useCotizacion*` + `useEmbarque*`** — Documentado como deuda aceptada en `ARCHITECTURE.md`. Mantener.
7. **`src/integrations/supabase/types.ts` (1,816 líneas)** — Auto-generado, no tocar. ✅
8. **Pages 200–290 líneas** (`ClienteDetalle`, `Reportes`, `PortalDashboard`, `Cotizaciones`, `Embarques`) — En el umbral aceptable. No urgente.

## Plan de remediación ordenado

| # | Acción | Riesgo | Esfuerzo | Prioridad |
|---|--------|--------|----------|-----------|
| 1 | Verificar que `DesempenoOperadores.tsx` delega cálculos a `useDesempenoChartData` y extraer lo que quede inline | Bajo | S | Media |
| 2 | Partir `ConceptoRows.tsx` en sub-componentes por tipo de fila | Bajo | S | Media |
| 3 | Añadir guardrails de tamaño (ESLint `max-lines`) para evitar regresiones futuras | Nulo | XS | Baja |
| 4 | (Cuando llegue v9.x) mover entradas v8.x de `changelogData.ts` a `legacy.ts` | Nulo | XS | Diferida |
| 5 | (Si crece) partir `NuevoClienteDialog.tsx` en steps | Bajo | M | Diferida |

## Recomendación

La arquitectura está **en muy buen estado**. No hay nada urgente. Sugiero ejecutar **#1 y #2** (refactors menores de UI) más **#3** (lint guardrail preventivo) en una sola iteración — todo bajo riesgo, ~30 min de trabajo. El resto es deuda diferida razonable.

