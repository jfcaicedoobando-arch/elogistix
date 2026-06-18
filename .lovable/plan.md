## P&L por contenedor — estilo CargoWise (sin sub-embarques reales)

Mantenemos **1 embarque = 1 expediente** (ELIMP00272). El contenedor sigue siendo entidad operativa, NO centro de utilidad independiente. Agregamos visibilidad de P&L por contenedor con prorrateo flat (÷N) de generales.

### Parte 1 — Helper puro de cálculo

Nuevo archivo `src/features/embarques/services/pnlPorContenedor.ts`:

- `calcularPnlPorContenedor({ contenedores, conceptosVenta, conceptosCosto }) → FilaPnlContenedor[]`
- Por cada contenedor:
  - `subexpediente`: `${embarque.expediente}-${String(orden).padStart(2, '0')}` (ej. `ELIMP00272-01`). Solo display.
  - `venta_directa` = suma de `conceptos_venta` con ese `contenedor_id`, agrupado por moneda.
  - `costo_directo` = idem para `conceptos_costo`.
  - `venta_prorrateada` = suma de `conceptos_venta` con `contenedor_id IS NULL` ÷ N contenedores.
  - `costo_prorrateado` = idem para costos generales.
  - `venta_total`, `costo_total`, `utilidad`, `margen_pct` por moneda.
- Fila adicional `'Generales'` mostrando los conceptos sin asignar (antes del prorrateo) para auditabilidad.
- Fila `'Total embarque'` que cuadra contra la P&L global existente.

**Reglas duras**:
- No se mezclan monedas; se devuelve un map `{ USD: [...], MXN: [...] }` o filas con columna `moneda`.
- Si N=0 contenedores → sólo fila `'Generales'` con los conceptos tal cual.
- El residuo del prorrateo flat (cuando `monto / N` no es entero a 2 decimales) se asigna al último contenedor para que la suma cuadre al centavo.

### Parte 2 — UI: nueva pestaña "P&L por Contenedor"

Nuevo componente `src/features/embarques/components/TabPnlContenedor.tsx`:

- Tabla con columnas: `Sub-expediente | # Contenedor | Tipo | Venta directa | Venta prorrateada | Venta total | Costo directo | Costo prorrateado | Costo total | Utilidad | Margen %`.
- Filas pintadas con el zebra-striping estándar; última fila `Total` en negrita.
- Toggle "Mostrar moneda: USD / MXN / Ambas" (default Ambas, una sub-tabla por moneda).
- Badge en el header de cada fila con el `subexpediente` (`ELIMP00272-01`) para que el usuario lo pueda copiar/usar como referencia operativa.
- Reutiliza `KpiCard` para mostrar 4 KPIs arriba: Venta total / Costo total / Utilidad / Margen %.
- Estado vacío: "Este embarque no tiene contenedores registrados."

Agregar `<TabsTrigger value="pnl-contenedor">P&L Contenedor</TabsTrigger>` en `EmbarqueDetalleTabs.tsx` justo después de la pestaña `pnl` existente. La pestaña `pnl` actual sigue mostrando la P&L global; la nueva muestra el desglose.

### Parte 3 — Subexpediente como etiqueta global

- Helper `formatSubexpediente(expedientePadre, orden) → string` en `src/lib/domain/embarque/subexpediente.ts` con test unitario.
- Usarlo también en:
  - `EmbarqueDetalleContenedoresTab` (badge en cada card de contenedor).
  - `TabCierre` cuando lista conceptos faltantes por contenedor.
- NO se guarda en BD. Es función pura `(expediente, orden) → string`.

### Parte 4 — Tests

- `pnlPorContenedor.test.ts` (puro, sin Supabase):
  - 1 contenedor + 0 generales → directo = total.
  - 3 contenedores + costo general 100 USD → cada uno carga 33.33, último 33.34 (residuo).
  - Mezcla USD/MXN no se cruza.
  - Concepto con `contenedor_id` inexistente (contenedor borrado) cae a "Generales".
  - Embarque sin contenedores → sólo fila Generales.
- `subexpediente.test.ts`: padding a 2 dígitos, manejo de orden 0/null, expediente vacío.
- `TabPnlContenedor.test.tsx` render smoke con mock de hook (cantidad de filas + presencia de subexpediente).

### Parte 5 — Metadata

- Bump `APP_VERSION` a `13.66.14`.
- Entrada en `CHANGELOG.md` raíz explicando: nueva pestaña P&L por contenedor con prorrateo flat de generales, subexpediente como display (no entidad), referencia al modelo CargoWise.

### Fuera de alcance (explícito)

- **NO** se crea tabla `embarques_hijos` ni columna `embarque_padre_id`. No hay sub-embarque real.
- **NO** se modifica la facturación: las facturas siguen siendo del embarque padre.
- **NO** se cambia el cierre: las reglas v13.66.12 aplican al embarque completo.
- **NO** se reasigna la regla de prorrateo a peso/volumen (decidiste flat ÷N). Si más adelante quieres peso/volumen, se agrega como toggle en la misma pestaña.
- **NO** se toca embarque 272 con migración de datos; ya quedó con conceptos repartidos por contenedor en pasos anteriores.

### Riesgos

- El subexpediente `ELIMP00272-01` puede confundirse con un expediente real si se exporta sin contexto. Mitigación: en exports/PDF siempre rotularlo "Ref. contenedor: ELIMP00272-01" en lugar de mostrarlo como folio.
- Si el orden de los contenedores cambia, el subexpediente cambia. Mitigación: `orden` ya es estable en `embarque_contenedores` y no se reasigna al editar.
