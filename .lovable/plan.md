## Auditoría visual — `/facturacion`

### 🔴 Hallazgo crítico: la guía "¿Cómo funciona este módulo?" está desactualizada

`GuiaPrefacturacion.tsx` todavía describe el módulo **anterior al rediseño v13.92** (6 tabs). Hoy muestra 4 pasos que no coinciden con la realidad:

| Guía dice | Realidad actual |
|---|---|
| 1. Por aprobar → Consolidar | ✅ existe como tab "1. Por timbrar" |
| 2. Proformas → Histórico | ❌ vive en `/proformas` (módulo aparte desde v13.94.0) |
| 3. Facturas → Emitidas | ✅ tab "2. Emitidas" |
| 4. Pagos prov. → Cuentas por pagar | ❌ vive en `/cxp/por-pagar` |
| — (falta) | Tab "3. Notas de crédito" no aparece en la guía |

El texto del ciclo también miente: "registras los pagos a tus proveedores (navieras, agentes, etc.)" — eso ya no se hace aquí.

### 🟡 Hallazgos visuales del dashboard

1. **Stack vertical abrumador** — antes de ver datos hay 5 bloques apilados: PageHeader · Guía · KPIs · Alerta Hueco · DateRangeFilter (cada uno en su propio Card). Ocupa toda la pantalla en 1440px.
2. **Redundancia "Por facturar" ↔ "Hueco de Facturación"** — el KPI amarillo (MXN 3.5M) y la alerta roja (MXN 3,493,590.66) muestran exactamente el mismo número. Es la misma información mostrada dos veces seguidas.
3. **Etiqueta duplicada en la alerta Hueco**: `USD USD 202,356.65` y `MXN MXN 3,493,590.66` — la moneda aparece dos veces.
4. **Mini-tendencia ilegible** — la columna de meses (`Ene · Feb · …`) se renderiza en stack vertical y se corta. Las barras de "Cobrado" quedan vacías cuando `cobrado_mes_mxn = 0` (sólo se ve la línea base). El componente no aclara la unidad ni el período exacto.
5. **DateRangeFilter en Card propio** desperdicia ~80px de alto. Cabe perfecto inline con las tabs o como toolbar discreto.
6. **Numeración redundante en tabs** — "1. Por timbrar / 2. Emitidas / 3. Notas de crédito": los íconos `Info` ya dan contexto, los prefijos numéricos son ruido (no son un wizard).
7. **Toolbar interno del tab "Por timbrar"** está en dos filas con espaciado desbalanceado (buscar + 2 selects arriba, botones "Consolidar / Aprobar individual" abajo). Visualmente se siente desordenado.
8. **KPI "Vencido (111)"** domina visualmente en rojo grande, pero `Por cobrar` y `Vencido` valen exactamente lo mismo (737.8K) — sugiere bug de datos o redundancia que el usuario no entiende.
9. **Botón "Nueva factura manual"** vive arriba a la derecha, lejos de las tablas donde el usuario decide capturar manual. Útil pero no descubrible cuando se está dentro de una tab.

---

## Propuesta de mejoras (alcance del cambio)

### A. Reescribir la guía (PRIORIDAD ALTA)

**Archivo:** `src/features/facturacion/components/GuiaPrefacturacion.tsx`

- Cambiar los 4 pasos por **3 pasos que reflejen las tabs actuales**:
  1. **Por timbrar** — "Proformas aprobadas listas para emitir CFDI"
  2. **Emitidas** — "CFDI vigentes + complemento de pagos (REP)"
  3. **Notas de crédito** — "Cancelaciones y devoluciones"
- Agregar una sección **"Esto ya no vive aquí"** con tres chips/links discretos:
  - Cobranza de clientes → `/cartera`
  - Pagos a proveedores → `/cxp/por-pagar`
  - Proformas (histórico) → `/proformas`
  - Proyección / cierre mensual → `/reportes/cierre-mensual`
- Reescribir el párrafo "Ciclo" para que mencione: emisión → REP en PPD → notas de crédito cuando corresponda.
- Mantener el callout amarillo del **Hueco de Facturación** (sigue siendo correcto).

### B. Compactar el "above the fold"

**Archivo:** `src/features/facturacion/routes/Facturacion.tsx`

- Quitar el `Card` envoltorio del `DateRangeFilter` y moverlo a la **misma fila que `TabsList`** (tabs a la izquierda, filtro de fechas a la derecha). Ahorra un bloque vertical.
- Cerrar la guía por defecto (ya es accordion) y bajar su prioridad visual a un link tipo "ℹ️ ¿Cómo funciona este módulo?" inline bajo el PageHeader.

### C. Eliminar redundancia entre KPI y alerta de Hueco

**Archivos:** `DashboardEjecutivoFacturacion.tsx` + `HuecoFacturacionCard.tsx`

- Opción elegida: **quitar el KPI "Por facturar" del dashboard** y dejar sólo la alerta `HuecoFacturacionCard` (es más rica: tiene desglose USD/MXN, conteo y CTA "Ver detalle"). Reemplazar ese hueco en el dashboard por un KPI más útil: **"REP pendientes"** o **"Por timbrar (#)"**.
- En `HuecoFacturacionCard`, arreglar el doble label: `USD 202,356.65` (no `USD USD …`) y `MXN 3,493,590.66`.

### D. Mejorar la mini-tendencia

**Archivo:** `DashboardEjecutivoFacturacion.tsx`

- Mostrar las etiquetas de mes **debajo** de las barras (alineadas), no en columna lateral.
- Cuando una serie es 0 en todo el rango, mostrar texto "Sin datos" en lugar de 6 líneas planas.
- Agregar tooltip al hover con valor exacto por mes.

### E. Limpiar tabs

**Archivo:** `Facturacion.tsx`

- Quitar prefijos "1. / 2. / 3." de los labels.
- Mover el botón **"Nueva factura manual"** también como acción primaria dentro del toolbar del tab "Emitidas" (donde más sentido tiene), manteniéndolo arriba como atajo global.

### F. Reordenar toolbar de "Por timbrar"

**Archivo:** `TabProformasPendientes.tsx`

- Una sola fila: `[Buscar] [Cliente] [Estado] · · · [N seleccionadas] [Aprobar individual] [Consolidar y aprobar]`.
- "Consolidar y aprobar" como botón primario, "Aprobar individual" como secundario `outline`.

---

## Fuera de alcance (lo menciono pero NO se toca)

- El bug de datos donde `Por cobrar` = `Vencido` (mismo monto) — eso es un tema de lógica de `useCobranza`, no visual.
- La lógica de generación de proformas, REP, o consolidación.
- Cambios a `/proformas`, `/cartera`, `/cxp`.

## Versionado

- Bump `APP_VERSION` a `13.95.0` (es minor: rediseño visible del módulo).
- Entrada en `CHANGELOG.md` agrupando los puntos A–F.

## Validación

- Screenshot before/after del above-the-fold (Playwright headless) para confirmar reducción de scroll y consistencia visual.
- Verificar accordion abierto/cerrado, alerta sin doble label, tendencia legible.
