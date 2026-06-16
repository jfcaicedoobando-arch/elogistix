# Pack B — Precarga ampliada Cotización → Embarque

Objetivo: que al crear un embarque desde una cotización **vinculada con desglose de costos**, se hereden todos los datos operativos relevantes (no sólo cliente/ruta básica), reduciendo recaptura y errores. Mantiene la regla de candado: sin desglose ⇒ no se puede crear embarque.

## Alcance funcional

Campos a heredar automáticamente al `EmbarqueFormValues` cuando se entra a `/embarques/nuevo?cotizacion=<id>`:

### B1 — Operación y comercial
- `incoterm` (FOB / CIF / DDP / …)
- `naviera_id` (si la cotización trae tarifa con naviera)
- `tipo_carga` (FCL / LCL / Aéreo / Terrestre)
- `modalidad` (Importación / Exportación)

### B2 — Ruta por modo
Ya está parcialmente en el mapper. Asegurar que se hereda el set correcto según `modo_transporte`:
- Marítimo: `puerto_origen_id`, `puerto_destino_id`
- Aéreo: `aeropuerto_origen_id`, `aeropuerto_destino_id`
- Terrestre: `ciudad_origen`, `ciudad_destino`

### B3 — Mercancía
- `descripcion_mercancia`
- `peso_kg`, `volumen_m3`, `valor_mercancia`, `moneda_valor`
- `es_peligrosa` + `clase_imo` + `un_number` (MSDS, ya parcial)
- `requiere_refrigeracion` + `temperatura_c`

### B4 — Contenedores (FCL)
- Precargar `embarque_contenedores` desde `cotizacion_costos` filtrando conceptos tipo "Flete marítimo" agrupados por `tipo_contenedor_id` y `cantidad`. Si la cotización trae 2x40HC + 1x20GP, crear 3 filas placeholder en el wizard (sin número de contenedor, sólo tipo).

### B5 — Tarifa y garantías
- `tarifa_id` (link a `costeo_tarifas` si la cotización fue cotizada con tarifa)
- `requiere_carta_garantia` (heredado de `costeo_navieras_condiciones`)
- `dias_libres_demoras` (tope sugerido del tabulador)

### B6 — Tarifa de venta de demoras
- Si la cotización tiene `costeo_demoras_venta_tarifa` ligada, copiar `tarifa_demoras_venta_id` al embarque para autocalcular demoras cliente desde el timeline.

## UX

- Cada campo precargado muestra `<HeredadoBadge tipoOrigen="cotizacion" origen={cot.folio} />` a la derecha del label.
- Si el usuario edita un campo precargado, el badge desaparece y se marca `overridesCotizacion[campo] = true` (mismo patrón que `tarifaOverride`).
- Banner superior del wizard: `"Datos heredados de cotización COT-2026-0123. Los cambios no se reflejarán de regreso."` con botón **"Ver cotización"**.
- En `DesvincularCotizacionDialog` (ya existe), la opción "Conservar datos" mantiene los valores; "Limpiar" los borra todos en una pasada usando `overridesCotizacion` como guía inversa.

## Detalles técnicos

### Archivos a tocar
- `src/lib/mappers/embarqueCotizacion.ts` — extender `mapCotizacionToEmbarqueDefaults()` con B1, B3 extendidos, B4, B5, B6.
- `src/lib/mappers/__tests__/embarqueCotizacion.test.ts` — nuevos casos: FCL 2 tipos contenedor, IMO peligrosa, tarifa con carta garantía, demoras venta ligada.
- `src/features/embarques/types/form.ts` — añadir campos `overridesCotizacion: Record<string, boolean>`, `tarifa_id?`, `requiere_carta_garantia?`, `dias_libres_demoras?`, `tarifa_demoras_venta_id?` (si faltan).
- `src/features/embarques/hooks/useNuevoEmbarqueCotVinculada.ts` — invocar mapper extendido y poblar `overridesCotizacion = {}` al inicio.
- `src/features/embarques/components/StepDatosGenerales.tsx` y secciones — pasar `tipoOrigen="cotizacion"` + `origen={folio}` al `HeredadoBadge` en cada campo heredado; suscribir `onChange` para marcar override.
- `src/features/embarques/components/secciones/BloqueContenedores.tsx` (o equivalente) — hidratar filas placeholder desde mapper.
- `src/features/embarques/components/DesvincularCotizacionDialog.tsx` — usar `overridesCotizacion` para "Limpiar".

### Queries
- Extender `getCotizacionById` (o equivalente) usado por el flujo de nuevo embarque para traer:
  - `cotizacion_costos(*, tipo_contenedor:tipos_contenedor(*))`
  - `tarifa:costeo_tarifas(*, naviera:navieras(*), condiciones:costeo_navieras_condiciones(*))`
  - `tarifa_demoras_venta:costeo_demoras_venta_tarifa(*)`

### Sin cambios en BD
No hay migración. Todo es lectura + mapeo cliente.

### Versionado
- Bump `APP_VERSION` a `13.30.0`.
- Entrada en `CHANGELOG.md` bajo `## [13.30.0] - 2026-06-16`.

## Fuera de alcance
- Sugerencia de Top 3 tarifas (Pack C).
- Sidebar sticky de progreso y role gate (Pack D).
- Sincronización bidireccional cotización ↔ embarque (no se contempla).

## Tests
- Unit: 4 casos nuevos en `embarqueCotizacion.test.ts`.
- Smoke manual: crear cotización con desglose FCL 2x40HC + IMO Clase 3 + naviera con carta garantía → crear embarque → verificar 6 secciones precargadas con badges.

## Pregunta de decisión
Cuando el usuario edita un campo heredado y luego **desvincula** la cotización eligiendo "Limpiar", ¿qué hacemos con los campos que él ya tocó (override)?
- **A.** Respetar el override del usuario (sólo limpiar los que siguen heredados puros). **Recomendado.**
- **B.** Limpiar todo sin distinguir.
