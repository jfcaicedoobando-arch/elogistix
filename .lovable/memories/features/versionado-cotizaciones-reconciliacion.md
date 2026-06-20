---
name: Versionado de cotizaciones y reconciliación 3 columnas
description: Fase 2 — `cotizacion_costos` inmutable; histórico por versión; reconciliación cotizado/refrescado/real
type: feature
---

# Contrato

- `cotizaciones.version` (int, default 1) — incrementa con cada re-cotización.
- `cotizaciones.version_aceptada` (int|null) — versión vigente para reconciliación.
- `cotizaciones.aceptada_en` / `aceptada_por` — sellos de aceptación.
- `cotizacion_costos_historico` — snapshot de los costos cuando se versiona.

# RPCs (SECURITY DEFINER, scoped a `organization_members`)

- `recotizar_cotizacion(p_cotizacion_id, p_motivo)` — archiva versión actual, incrementa `version`, vuelve a `Borrador`. Motivo obligatorio. Bitácora `cotizacion.versionada`.
- `aceptar_cotizacion_version(p_cotizacion_id)` — fija `version_aceptada = version`, estado `Aceptada`. Bitácora `cotizacion.aceptada_version_fijada`.
- `obtener_costos_cotizacion_version(p_cotizacion_id, p_version?)` — lee costos vivos o históricos según la versión.

# Reconciliación 3 columnas (por embarque)

`obtenerReconciliacion3Columnas(embarqueId)` combina:

1. **Cotizado**: `obtener_costos_cotizacion_version(cotizacion_id, version_aceptada)`.
2. **Refrescado**: cotizado + `embarques.tarifa_delta_jsonb` (Fase 1).
3. **Real**: `conceptos_costo` vivos del embarque.

Alineación por `(concepto, moneda)` case-insensitive. Conceptos reales sin contraparte cotizada aparecen con cotizado/refrescado = 0.

# Umbrales (tabla `configuracion`, categoría `operaciones`, POR ORGANIZACIÓN)

- `reconciliacion_varianza_alerta_pct` (default 10) — % desde el cual la varianza se marca como alerta.
- `reconciliacion_varianza_critica_pct` (default 25) — % desde el cual se marca como crítica.
- Cada empresa edita sus propios umbrales en `/configuracion → Operaciones` (NO en Super Admin).
- Hook de lectura: `useUmbralesReconciliacion` (cae a `UMBRALES_DEFAULT` de `versionadoCotizacion.ts` si no hay valor).
- Unicidad BD: `configuracion (organization_id, categoria, clave)`. RLS de lectura: `organization_id = current_user_org_id()`.

# UI

- `RecotizarModal` — motivo ≥5 chars + tipear "RECOTIZAR" para confirmar.
- `ReconciliacionTresColumnas` — tabla, filtro "sólo con varianza", export CSV, badges por clasificación.

# Reglas

- `cotizacion_costos` NUNCA se actualiza directamente para una cotización aceptada: pasa por `recotizar_cotizacion`.
- Fase 1 (`revalidar_tarifa_cotizacion` + `tarifa_delta_jsonb`) provee la columna "refrescado".
