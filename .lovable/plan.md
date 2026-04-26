# Auditoría arquitectónica (post v8.75.0)

## Estado general

Excelente. Tras los 8 pasos del plan anterior:
- **0 imports directos a Supabase** desde `hooks/`, `components/` o `pages/`.
- **0 imports de `sonner`** (toasts unificados en `useToast`).
- `src/lib/` reorganizado en subcarpetas semánticas.
- Histórico de changelog particionado por major.
- 17 componentes shadcn no usados eliminados.
- **196/196 tests** pasando, tsc limpio.

La base es sólida. Lo que queda es **deuda menor** y **pulido fino**.

## Hallazgos abiertos (priorizados)

### Críticos

**C1 — `useNuevoEmbarqueWizard.ts` (314 LOC)**
Sigue siendo el único hook que excede el guardrail de 250 LOC (junto con `sidebar.tsx` de shadcn que no se toca). Aunque parte de la lógica ya se extrajo en v8.71 a `lib/domain/embarqueWizard.ts`, el hook aún concentra: estado del wizard + hidratación desde cotización + manejo de `modoExpediente` + orquestación del submit con 4 servicios (resolverExpediente, subirDocumentos, createEmbarque, updateEstadoCotizacion, registrarActividad).

Sub-extracciones posibles:
- `useCotizacionHydration(cotizacionId)` → encapsula el `useCotizacion` + `useEffect` que hidrata el form al elegir cotización.
- `useExpedienteResolver(clienteId, modoExpediente)` → expediente nuevo/existente.
- `submitNuevoEmbarque()` como función pura en `lib/domain/embarqueWizard.ts` que reciba dependencies inyectadas (testeable sin React).

### Medios

**M1 — Páginas portal con lógica de UI compleja**
- `PortalCotizacionDetalle.tsx` (288 LOC): mezcla render + estado de confirmación + handlers de aceptar/rechazar + textarea de comentario.
- `PortalEmbarqueDetalle.tsx` (251 LOC): lógica similar de estado local mezclada con presentación.

Ambas exceden 250 LOC. Extraer un controller hook por página (mismo patrón aplicado en `TabProformas`).

**M2 — Colores categóricos hardcodeados aún presentes**
Quedan ~7 archivos con clases `bg-{color}-{n}`:
`ConceptoRowUSD.tsx`, `ResumenConceptosVenta.tsx`, `ReportesKpiCards.tsx`, `OperacionesWidgets.tsx`, `ClienteSummaryCards.tsx`, `pages/Operaciones.tsx`, `KpiCard.tsx`.

(Los archivos `lib/ui/uiMappings.ts` y `estadoConfig.ts` se mantienen — son **paletas categóricas** intencionales, no semánticas, y ya están centralizadas.)

Definir tokens semánticos extra (`--metric-positive`, `--metric-neutral`, `--metric-warning`) o reutilizar `success/warning/info` para KPIs.

**M3 — `lib/mappers/embarque.ts` (241 LOC)**
Cerca del límite. Contiene mappers de form↔DB para embarques. Posible split por dirección (`embarqueFromDb.ts` / `embarqueToDb.ts`) si crece más.

### Opcionales

**O1 — Dependencias huérfanas en `package.json`**
Se eliminaron 17 componentes shadcn pero las libs siguen instaladas:
`embla-carousel-react`, `react-resizable-panels`, `vaul`, `input-otp`. Quitarlas reduce `node_modules` y bundle.

**O2 — `src/types/types.ts` genérico**
Archivo con nombre poco descriptivo. Auditar contenido y renombrar/dividir según dominio (p. ej. `commonTypes.ts`, o mover a sus dominios respectivos).

**O3 — Subcarpetas vacías en `lib/` agregar `index.ts` barrels**
Subcarpetas como `formatters/`, `storage/`, `errors/`, `contacto/`, `query/` ya tienen `index.ts`. Las que tienen múltiples archivos (`financial/`, `ui/`) podrían añadir un `index.ts` barrel para imports más limpios:
`import { formatCurrency, calcularUtilidad } from "@/lib/financial"` en lugar de `/financial/financialUtils`.

**O4 — `src/components/ui/sidebar.tsx` (637 LOC)**
Es código shadcn estándar. **No tocar** salvo que se quiera customizar fuertemente.

## Plan de acción ordenado

| # | Versión | Acción | Riesgo | Impacto | Estado |
|---|---------|--------|--------|---------|--------|
| 1 | v8.73.0 | **C1**: Adelgazar `useNuevoEmbarqueWizard`. | Medio | Alto | ✅ |
| 2 | v8.74.0 | **M1**: Controller hooks para `PortalCotizacionDetalle` y `PortalEmbarqueDetalle`. | Bajo | Medio | ✅ |
| 3 | v8.75.0 | **M2**: Tokens semánticos para KPIs y migrar los 8 archivos restantes a variantes. | Bajo (visual) | Medio | ✅ |
| 4 | v8.76.0 | **O1**: Desinstalar dependencias huérfanas (`embla`, `vaul`, `input-otp`, `react-resizable-panels`). | Muy bajo | Bajo (bundle) | ⏳ |
| 5 | v8.77.0 | **M3**: Split de `mappers/embarque.ts` por dirección si supera 250 LOC nuevamente. | Bajo | Bajo | ⏳ |
| 6 | v8.78.0 | **O2 + O3**: Renombrar/dividir `types/types.ts` y añadir barrels en `lib/financial` y `lib/ui`. | Muy bajo | Bajo | ⏳ |

## Próximo paso

Ejecutar **Paso 4 (v8.76.0)** — desinstalar dependencias huérfanas tras la limpieza de shadcn (verificar previamente con `rg "from ['\"]<dep>" src` cada paquete).

## Detalles técnicos

**Paso 1 (C1)** — Funciones a extraer:
- `useCotizacionHydration({ cotizacionId, proveedores, onHydrate })` — hook con `useCotizacion` + `useEffect`.
- `lib/domain/embarqueWizard.ts::buildSubmitPayload(form, conceptos, expediente)` — pura.
- `lib/domain/embarqueWizard.ts::resolveModoExpediente(clientes, clienteId)` — ya parcialmente extraída, completar.

**Paso 3 (M2)** — Tokens propuestos en `index.css`:
```css
--metric-positive: 142 71% 45%;  /* alias de success para KPIs */
--metric-warning:  38 92% 50%;
--metric-danger:   0 84% 60%;
--metric-neutral:  220 14% 75%;
```
Crear `<KpiBadge variant="positive|warning|danger|neutral" />` reutilizable.

**Paso 4 (O1)** — Verificar antes de borrar con `rg "from ['\"]<dep>" src` para cada paquete.
