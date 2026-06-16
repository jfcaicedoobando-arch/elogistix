# Mejora integral del proceso de cotización

Consolidación de lo platicado: reordenar el wizard, atajo "sin desglose" con candado, y precarga completa al crear embarque desde cotización.

## Bloque 1 — Reordenar Paso 1 del wizard (UX conversacional)

Nuevo orden (de lo general a lo específico):

1. **¿Para quién?** — Cliente / prospecto.
2. **¿Qué operación?** — Modo, Tipo, Incoterm (+ Modalidad si Terrestre).
3. **¿De dónde a dónde?** — Origen, destino, tránsito.
4. **¿Qué se mueve?** — FCL/LCL, contenedor, peso, volumen, dims, MSDS.
5. **Tarifa vinculada** (sólo marítimo) — ahora con ruta + contenedor ya capturados para que el botón "Sugerir tarifa" funcione bien.
6. **Condiciones** — Días libres, almacenaje, seguro, carta garantía.
7. **Cierre** — # embarques + Notas (acordeón abierto por defecto).

Mejoras tácticas en Paso 1:

- Resumen lateral sticky con lo capturado.
- Validación inline por bloque (no esperar al final).
- Botón "Sugerir tarifa" basado en ruta + contenedor.
- Badge "Heredado de tarifa" en campos auto-llenados desde una tarifa marítima.

## Bloque 2 — "Cotizar sin desglose" con candado duro

### En Paso 1

- Botón secundario "Cotizar sin desglose de costos" junto al primario "Continuar a costos".
- Al hacer click: **modal destructivo** (no toast) con:
  - Título: "¿Cotizar sin cargar costos?"
  - Explicación: sin P&L, sin margen calculado, embarque **bloqueado** hasta cargar costos, práctica desaconsejada.
  - Checkbox obligatorio: "Entiendo que esta cotización no tiene costos cargados y el embarque no podrá iniciarse hasta completarlos."
  - Botones: "Cancelar" (default) / "Sí, cotizar sin desglose" (destructive, deshabilitado hasta marcar checkbox).
- Si confirma: salta directo a Paso 3 (Cotización Cliente) y marca `cotizaciones.sin_desglose_costos = true`.

### En Paso 3, detalle y listado

- Banner persistente (warning amarillo): "Esta cotización fue creada sin desglose de costos. Cargar costos antes de convertir a embarque." CTA "Cargar costos ahora" → abre Paso 2.
- Badge "Sin costos" en el listado mientras `cotizacion_costos.length === 0`.
- Badge interno "Sin desglose interno" en preview (no en PDF cliente).

### Candado al crear embarque

- En `useNuevoEmbarqueCotVinculada` y todo botón "Convertir a embarque":
  - Validar: si `cotizacion_costos` tiene 0 filas → **bloquear**.
  - Modal de bloqueo: "No se puede crear el embarque. Esta cotización no tiene costos cargados." CTA "Ir a cargar costos" / "Cancelar".
- Regla canónica: el candado se basa en existencia de `cotizacion_costos`, no en el flag (por si se cargaron costos después).

### Bitácora

- `cotizacion_sin_desglose_creada` al usar el atajo.
- `embarque_bloqueado_sin_costos` cuando se intenta convertir y se bloquea.

## Bloque 3 — Precarga completa al crear embarque desde cotización

Hoy `mapConceptosVentaFromCotizacion` / `mapConceptosCostoFromCotizacion` ya precargan conceptos. **Agregar precarga de:**

- **Ruta:** origen, destino, tránsito.
- **Mercancía:** tipo_carga, tipo_embarque, tipo_contenedor, # contenedores, peso, volumen, piezas, dimensiones.
- **MSDS / peligrosos:** referencia + checklist de documentos requeridos.
- **Condiciones:** días libres, almacenaje, seguro, carta garantía.
- **Tarifa marítima:** como vínculo (`tarifa_id`), **no copia** de valores.
- **Notas** de la cotización.

Reglas de herencia:

- Mostrar badge "Heredado de cotización FOLIO-XXX" en todos los campos precargados.
- Cambios en el embarque NO modifican la cotización.
- **Desvincular cotización** en el embarque ofrece 3 opciones:
  1. Conservar datos heredados (default).
  2. Limpiar sólo conceptos.
  3. Limpiar todo lo heredado.

## Detalles técnicos

- **Schema:** migración que agrega `sin_desglose_costos boolean NOT NULL DEFAULT false` a `cotizaciones`.
- **Componentes nuevos:**
  - `ConfirmSinDesgloseDialog.tsx`
  - `SinDesgloseBanner.tsx`
  - `BloqueoEmbarqueSinCostosDialog.tsx`
  - `HeredadoBadge.tsx` (reusable)
- **Componentes a modificar:**
  - `CotizacionWizardLayout.tsx` y subcomponentes de Paso 1 (reorden + botón sin desglose + resumen sticky).
  - Listado y detalle de cotización (banner + badge + filtro opcional).
  - `useNuevoEmbarqueCotVinculada` + handlers de "Convertir a embarque" (candado + precarga ampliada).
  - `embarqueWizard.ts` / mappers — extender precarga a ruta, mercancía, condiciones, notas, tarifa_id.
- **Cumple reglas del proyecto:** componentes ≤200 líneas (dividir si crece), sin `any`, manejar `error` de Supabase, cleanup en effects, RHF con `{shouldValidate, shouldDirty}` + `trigger()`, no inline styles.
- **Changelog + APP_VERSION:** bump menor por bloque entregado, entrada en `CHANGELOG.md` raíz.

## Orden sugerido de entrega

1. **Bloque 2** (sin desglose + candado) — riesgo operativo más alto, gana primero.
2. **Bloque 3** (precarga ampliada) — desbloquea la promesa "cotización → embarque sin retrabajo".
3. **Bloque 1** (reorden + UX) — mejora continua, no urgente.

## Fuera de alcance

- No tocar Paso 2 (cost board) ni el motor de cálculo de márgenes.
- No permitir cargar costos parciales como bypass del candado.
- No cambiar el wizard de embarque más allá de aceptar más campos precargados.

## Preguntas abiertas

- ¿"Cotizar sin desglose" disponible para cualquier vendedor o solo para gerencia comercial (role gate)? si, para cuialquier vendedor
- ¿Quieres filtro rápido "Sin costos" en la toolbar del listado de cotizaciones? no es necesario
- En la desvinculación, ¿el default debe ser "Conservar datos" o "Limpiar sólo conceptos"? conservar datos