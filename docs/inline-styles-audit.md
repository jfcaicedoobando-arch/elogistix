# Inline styles — Auditoría 12.2.0

Auditoría exhaustiva de las **64 ocurrencias** de `style={{…}}` en `src/`
(`rg -n "style=\{\{" src -g '!*.test.*'`), clasificadas contra las excepciones
de `mem://principles/inline-styles`.

| Categoría | # | Justificación |
|---|---:|---|
| **react-pdf** (`src/pdf/**`) | 38 | `@react-pdf/renderer` no soporta clases CSS; usa `style={...}` sobre primitivos `<View>`, `<Text>`, `<Page>`. Exención explícita. |
| **Virtualizer** (`@tanstack/react-virtual`) | 9 | `transform`, `height`, `gridTemplateColumns` calculados por el virtualizer en cada render. Sin alternativa Tailwind. Archivos: `VirtualDataTable`, `VirtualRow`, `VirtualTableParts`, `bitacora/VirtualTimeline`. |
| **% dinámico** | 6 | `width: ${pct}%` calculado en runtime (barras de progreso, timeline). Archivos: `PortalEmbarqueDetalle`, `CargasActivasClienteCard`, `PortalEstadoEmbarquesCard`, `auditoria/ejecutivo/_helpers` (×2), `progress.tsx`. |
| **Color desde DB** | 3 | `etapa.color` proviene de `crm_etapas.color` (columna). No puede traducirse a token estático. Archivos: `OportunidadKanban`, `OportunidadKpisCards`, `dashboard` (gradientes de etapa). |
| **Color desde constante runtime indexada por estado** | 6 | `ESTADO_COLOR[estado]` (mapping fijo de 7 estados de embarque → hex). Equivalente funcional a "color desde DB": el valor se elige en runtime por dato. Archivos: `OperadorCard` (×2), `ClienteExpandible` (×2), `EmbarquesEstadoDialog` (×2). |
| **Dimensión calculada** (height/size desde prop) | 2 | `height: ${height}px` (ChartSkeleton), `width/height: size + 12` (ModoIcon). Valor numérico aritmético por prop. |

**Total auditado: 64 ocurrencias — 0 violaciones.**

Todas las ocurrencias caen en una de las excepciones documentadas. No se
introduce comentario `// SAFE-CAST` porque ese marcador aplica únicamente a
`as unknown as T` (ver `mem://principles/safe-cast`), no a inline styles.

## Cómo se mantiene esta lista
- ESLint regla `react/forbid-dom-props` no está activa por las múltiples excepciones legítimas.
- Re-correr `rg -n "style=\{\{" src -g '!*.test.*'` cuando suba el conteo y clasificar nuevas ocurrencias contra esta tabla. Si una nueva no encaja en ninguna categoría, refactorizar a clase Tailwind / token semántico.
