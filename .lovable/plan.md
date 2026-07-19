## Revisión Sprint 2 · Ola 1 (`v13.302.1`)

- ✅ Lint 0 warnings, sin regresiones de tipos.
- ✅ 6 páginas migradas a `width="wide"` (Facturación + 5 de Compras).
- ⚠️ **Falta test** que verifique que `width="wide"` renderiza `max-w-[1720px]` (el test actual sólo cubre default + `noSpacing`).
- ✅ No detecté bugs: el prop es aditivo, default preservado, no toca UI de páginas normales.

## Sprint 2 · Ola 2 — Unificación KpiCard (pnl) + test faltante

**Alcance intencionalmente pequeño y seguro.** Dejamos `operaciones/components/KpiCard.tsx` para una ola posterior porque tiene otra API (Spanish: `titulo/valor/icono/color`, chip de ícono, 5 consumidores) y merece su propia migración con matriz de aliases de color.

### 1. Test de regresión `PageContainer width="wide"`
Añadir un caso en `src/components/shared/__tests__/primitives.test.tsx` que asegure que:
- `width="wide"` → clase `max-w-[1720px]` presente, `max-w-screen-2xl` ausente.
- Sin prop → sigue en `max-w-screen-2xl` (guarda de default).

### 2. Consolidar `features/embarques/components/pnl/KpiCard.tsx` → canónico
Sólo 2 consumidores:
- `src/features/embarques/components/TabPnl.tsx`
- `src/features/embarques/components/_sections/TablaPnlPorMoneda.tsx`

Ambos usan la API `{ label, value, delta?, tone? }` con `tone: default|success|destructive|warning`. El canónico usa `variant` con los mismos nombres semánticos + `success/destructive/warning`. El mapeo es 1:1 (sólo cambia el nombre del prop `tone`→`variant`). Migrar callers, borrar el clon local, y añadir un test smoke que rendericé ambos consumidores para prevenir regresión.

### 3. Bump + changelog
`APP_VERSION` → `13.302.2` y bullet en `CHANGELOG.md` con analogía para principiante.

### Detalles técnicos
- El clon `pnl/KpiCard` renderiza `CardHeader` + `CardContent` (padding default), el canónico renderiza sólo `CardContent p-4`. Visualmente el canónico queda un poco más compacto — coherente con Sprint 1 (densidad). Si el usuario prefiere respetar el look actual con header, se puede pasar `sublabel` en el canónico, pero recomiendo aceptar la densidad del canónico.
- Rangos de tono `default|success|destructive|warning` existen en el canónico como `variant`. No hay `info` en el clon, no hay pérdida.
- Riesgo bajo: sólo 2 archivos migran; test smoke previene bug.

### Qué NO se toca en esta ola
- `operaciones/components/KpiCard.tsx` (5 consumidores, API distinta, requiere plan aparte).
- Padding unificado de `Card` (>80 archivos con `<Card`, requiere criterio consensuado tabla/detalle).
- Ancho de página en otras rutas fuera de Facturación/Compras.

### Verificación final
- `bun run lint -- --max-warnings 0`.
- `bunx vitest run src/components/shared/__tests__/primitives.test.tsx src/features/embarques/components/TabPnl` (o el path del smoke nuevo).
