## Unificar paso 2 del wizard contra `catalogo_claves_sat`

### Contexto

- **Paso 3** (`ConceptoDescripcionSelector` → `ProductoServicioSelect`) es combobox **estricto** contra `catalogo_claves_sat` y autocompleta: descripción, `aplica_iva`, `tasa_iva_aplicada` y `clave_unidad_sat`.
- **Paso 2** (`TablaCostosLocal`) usa un `<Select>` con dos arrays hardcoded (`CONCEPTOS_COSTO_USD` / `CONCEPTOS_COSTO_MXN`) y para unidad usa `UNIDADES_MEDIDA = ['BL','W/M','Documento',...]`, también hardcoded.
- Consecuencia: (1) los "conceptos" del paso 2 pueden no existir en el catálogo maestro y llegan al paso 3 como legacy con banner ámbar, (2) desalineación con clave SAT/IVA/unidad, (3) mantenimiento en dos lugares.

### Objetivo

El paso 2 sólo permite conceptos del catálogo maestro (mismo origen que el paso 3), heredando además clave SAT, unidad SAT e IVA sugerido.

### Alcance

1. **`TablaCostosLocal.tsx`** — reemplazar el `<Select>` de concepto por `ProductoServicioSelect`. Al seleccionar producto:
   - `concepto` ← `producto.nombre`.
   - `unidad_medida` ← `producto.clave_unidad_sat` (si viene) y sólo si la fila no tiene un valor manual explícito.
   - `aplica_iva` ← `producto.tipo_iva === 'gravado_16'`.
   - Guardar `clave_sat` en la fila (nuevo campo opcional en `FilaCostoLocal`) para que viaje al paso 3 sin recalcular.
2. **`FilaCostoLocal`** — agregar campos opcionales `clave_sat?: string`, `tasa_iva_aplicada?: number` para propagar el match del catálogo.
3. **`UNIDADES_MEDIDA` en `TablaCostosLocal`** — sustituir por `UnidadMedidaSelect` ya existente (o dejar el select actual pero alimentado por el catálogo de claves de unidad SAT). Se elige la variante `UnidadMedidaSelect` para consistencia con paso 3.
4. **`buildCostosDesdeTarifa.ts`** — al precargar desde una tarifa, intentar matchear el `concepto` generado contra el catálogo (por `porNombre` o helper nuevo `matchProductoPorNombre`) para heredar `clave_sat` / `unidad`. Si no matchea, deja el concepto como está (fila "legacy" que el usuario deberá corregir manualmente antes de avanzar). Se hace fuera del hook (helper puro que recibe la lista de productos) para no romper la firma actual.
5. **`SeccionCostosInternosPLLocal.tsx`** — pasa la lista de productos del catálogo al llamado de `buildCostosDesdeTarifa` para el match.
6. **`useCotizacionWizardSteps` / `buildConceptosFromCostos`** — hoy mapea `costo → concepto_venta` por nombre. Ahora, si la fila trae `clave_sat`/`tasa_iva_aplicada`, se propagan al concepto de venta directamente en vez de re-buscar en el catálogo. Beneficio: cero desalineación entre pasos y menos trabajo del combobox del paso 3.
7. **Constantes legacy** — dejar `CONCEPTOS_COSTO_USD` / `CONCEPTOS_COSTO_MXN` en `cotizacionConstants.ts` con `@deprecated`, y buscar otros usos para migrarlos o retirarlos.
8. **Migración de datos (opcional, pequeña)** — no toca tablas. `catalogo_claves_sat` ya está poblado; sólo se verifica que los patrones más usados de las viejas constantes existan como registros activos. Si falta alguno (p. ej. "Flete Marítimo LCL"), se propone un migration seed **read-only en el plan** para agregarlos como activos por organización (o global si el catálogo es global — pendiente confirmar en implementación).
9. **Tests**:
   - `TablaCostosLocal.test.tsx`: seleccionar producto propaga concepto + unidad + `aplica_iva`.
   - `buildCostosDesdeTarifa.test.ts`: cuando se pasa la lista de productos, hereda `clave_sat` al match; si no matchea, fila queda sin `clave_sat` y no rompe.
   - Test de integración wizard: paso 2 → paso 3 mantiene `clave_sat` sin que el paso 3 tenga que re-buscar.
10. **Changelog + bump** a `13.292.0` explicando la unificación y el impacto (los conceptos legacy que estén guardados como texto libre siguen funcionando pero se marcan como legacy en el combobox del paso 2, igual que ya pasa en paso 3).

### Fuera de alcance

- Editor del catálogo maestro (ya existe en `/configuracion`).
- Migración masiva de cotizaciones históricas: se dejan como legacy; el warning ámbar del combobox guía al usuario.
- Cambios de esquema en `cotizacion_costos` (no se persiste `clave_sat` a BD en esta fase; sólo viaja en memoria del wizard).

### Riesgos

- Cotizaciones en edición cuyos costos tienen nombres que no existen en el catálogo: el combobox del paso 2 los mostrará como legacy (banner ámbar) y bloqueará el guardado sólo si el usuario los toca. Comportamiento igual al paso 3 actual.
- Si el catálogo está vacío en una organización recién creada, el paso 2 queda sin opciones; se maneja con estado "catálogo vacío" reutilizado de `ProductoServicioSelect` que sugiere ir a Configuración → Catálogo.

### Verificación

- `bunx vitest run` de los archivos tocados + suites del wizard.
- QA manual en `COT-2026-0123` (LCL): editar costos y confirmar que paso 3 recibe clave SAT y unidad correctas sin banner ámbar.
