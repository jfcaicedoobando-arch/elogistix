## Fase 6 — Proformas multi-contenedor

### Objetivo
Cerrar el modelo 1↔N en el flujo de proformas: que el operador vea de un vistazo qué conceptos pertenecen a qué contenedor, que los defaults sean razonables al abrir el diálogo, y que la proforma generada/consolidada y su PDF reflejen correctamente el desglose por contenedor.

### Alcance
Sólo flujo de proformas dentro del embarque (`TabFacturacion`, `DialogGenerarProforma`, servicios `proforma/*`, PDFs `ProformaDocument` / `ProformaConsolidadaDocument`). **No** tocamos facturación CFDI ni cotizaciones.

### Paso 1 — Resumen de conceptos venta agrupado por contenedor
En `ResumenConceptosVenta` (hoy plano):
- Agrupar conceptos por `contenedor_id` cuando el embarque tiene ≥2 contenedores activos.
- Cabecera por grupo: `Contenedor #N — <numero>` + subtotal del grupo en su(s) moneda(s).
- Sección "Cargos generales (BL)" para conceptos con `contenedor_id = null`.
- Si el embarque tiene 1 contenedor, mantener vista plana actual.

### Paso 2 — Defaults del diálogo "Generar proforma"
En `DialogGenerarProforma` / `useGenerarProformaState`:
- Si el embarque tiene ≥2 contenedores, abrir con `filtroContenedor = 'todos'` (ya hoy) pero **preseleccionar sólo los conceptos del primer contenedor con pendientes**, en vez de seleccionar todo. Reduce el riesgo de facturar de más cuando el operador quiere una proforma por contenedor.
- `diasCredito` ya viene del cliente; verificar y dejar comentario explícito si llega vacío → `0` (Contado).
- IVA: respetar `aplica_iva` del concepto como default (hoy arranca en `false`); arrancar `ivaPorConcepto[id] = c.aplica_iva ?? false` para conceptos MXN obligatorios y USD opcionales.

### Paso 3 — Acción rápida "Proforma por contenedor"
En `ResumenConceptosVenta`, junto al botón actual "Generar proforma":
- Botón secundario "Por contenedor" (sólo visible si ≥2 contenedores con pendientes).
- Abre el mismo diálogo pero arranca con `filtroContenedor = <id del primer contenedor con pendientes>` y todos sus conceptos preseleccionados. Permite encadenar N proformas rápido sin re-filtrar.

### Paso 4 — PDF de proforma con desglose por contenedor
En `ProformaDocument` (single) y `ProformaConsolidadaDocument`:
- Cuando la proforma contiene conceptos de ≥2 contenedores distintos (o mezcla contenedor + BL), agrupar la tabla de conceptos por contenedor con subtotal por grupo.
- Si todos los conceptos pertenecen a un solo contenedor, agregar línea en el header del PDF: `Contenedor: <numero> (<tipo>)`.
- Tablas existentes no cambian para proformas mono-contenedor sin desglose.

### Paso 5 — Consolidado: validación cross-contenedor
En `consolidar.ts`:
- Permitir consolidar proformas de distintos contenedores del mismo embarque (caso normal).
- Bloquear consolidación si las proformas pertenecen a embarques distintos con cliente distinto (ya hoy debería; verificar y agregar mensaje claro).

### Paso 6 — Documentación
- `CHANGELOG.md` → `## [12.14.0]` con bullets por cada paso.
- Bump `APP_VERSION` a `12.14.0`.
- Añadir nota corta en `docs/embarques-contenedores.md` sobre cómo se reflejan los hijos en proformas y PDF.

### Detalles técnicos
- Sin migraciones SQL — todo es lógica de UI/servicio sobre el modelo ya existente (`conceptos_venta.contenedor_id`, `embarque_contenedores`).
- Reusar `lib/domain/conceptosPorContenedor.ts` que ya hace el agrupamiento para los filtros del diálogo.
- Mantener componentes ≤200 líneas (Power of 10): `ResumenConceptosVenta` agrupado probablemente requiere extraer un subcomponente `GrupoConceptosContenedor`.
- Tipos estrictos: extender `ProformaConcepto` (en `services/proforma/types.ts`) con `contenedor_id` y `contenedor_numero` para que el PDF no tenga que volver a consultar.

### Out of scope
- Editar números de contenedor / BL Master desde la UI de proformas (eso vive en EditarEmbarque).
- Indicador "Datos pendientes de captura" en la lista de embarques (opcional, lo dejamos para 12.14.1 si se decide).
- Facturación CFDI a partir de proformas multi-contenedor (ya funciona; sólo PDF se mejora visualmente).

### Entregables
1. `ResumenConceptosVenta` agrupado + nuevo subcomponente `GrupoConceptosContenedor`.
2. Defaults mejorados en `useGenerarProformaState` (selección y IVA por concepto).
3. Botón "Por contenedor" en el resumen.
4. PDF de proforma con desglose por contenedor.
5. `CHANGELOG.md` + bump versión `12.14.0`.
6. Actualización breve en `docs/embarques-contenedores.md`.
