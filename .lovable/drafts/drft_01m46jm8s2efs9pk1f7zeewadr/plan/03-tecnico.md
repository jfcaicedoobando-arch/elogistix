## Detalles técnicos
- Migración aditiva (se aplica al aceptar el borrador):
  - `costeo_tarifas`: columnas `solicitud_pricing_id` (FK a `crm_solicitudes_pricing`, RESTRICT, misma org vía trigger), `carta_garantia boolean`, `unidad_flete text`.
  - `costeo_tarifa_recargos`: columna `unidad text` si no existe.
  - Folio: `_crm_sol_pricing_before_ins` usa `folio_secuencias` con `tipo = 'pricing_' || to_char(now() at time zone 'America/Mexico_City','YYMM')`, prefijo de mes en español por arreglo fijo, `lpad(n,4,'0')`.
  - Renumerar las 3 solicitudes existentes (desactivando temporalmente la guardia de folio inmutable dentro de la migración) y actualizar el texto de sus notificaciones; sembrar secuencia `pricing_2610` en 3.
  - Copiar la opción existente de `crm_pricing_opciones` a `costeo_tarifas` + recargos; la tabla vieja queda sólo lectura (no se borra).
  - `crm_responder_solicitud_pricing`: exige ≥1 tarifa ligada en vez de ≥1 opción.
- Frontend: renombrar etiqueta de menú/título de `/costeo/tarifas` a "Solicitudes de pricing" y redirigir `/costeo/solicitudes` a ella con filtro por solicitud; `TarifaForm` acepta `solicitudPricingId` y nuevos campos; detalle de solicitud lista tarifas ligadas; retirar `OpcionPricingEditor`/`CargosPricingCampos`.
- Actualizar prueba de arquitectura de notificaciones (ruta), pruebas focalizadas de folio y formulario; archivos ≤200 líneas; `db:postcheck` tras aceptar. CI/RLS completos en GitHub Actions. Sin cambio de versión salvo autorización.
