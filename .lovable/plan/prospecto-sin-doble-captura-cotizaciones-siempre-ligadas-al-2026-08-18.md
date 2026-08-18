# Prospecto sin doble captura + cotizaciones siempre ligadas al CRM

## Qué pasa hoy (verificado)

- El diálogo "Convertir Prospecto a Cliente" ya precarga empresa, contacto, email y teléfono desde la cotización, pero **RFC, dirección, ciudad, estado y C.P. siempre se capturan de cero**: la cotización sólo guarda 4 campos de prospecto (`prospecto_empresa`, `prospecto_contacto`, `prospecto_email`, `prospecto_telefono`) y el lead del CRM no tiene RFC, dirección ni C.P. Ahí está la doble captura real.
- La liga con el CRM es "falla suave": si truena, la cotización se guarda igual y sólo sale un toast. En la base hay **16 de 19 cotizaciones de prospecto sin oportunidad** (y 172 de 176 cotizaciones en total sin `oportunidad_id`). El hueco es real y grande.

## Ola 1 — Capturar el dato fiscal una sola vez

1. Ampliar el CRM para que el lead guarde los datos que hoy se piden dos veces: RFC, dirección, C.P. y país (ciudad/estado ya existen en el lead).
2. En el Paso 1 del wizard, la sección "Prospecto" gana un bloque opcional y colapsado **"Datos fiscales (opcional)"**: RFC, dirección, ciudad, estado, C.P. Nada de esto bloquea avanzar.
3. Esos datos se guardan en el lead al crearlo/actualizarlo.
4. Al abrir "Convertir Prospecto a Cliente", el formulario se precarga **desde el lead + la cotización**. Si el lead ya tiene RFC y dirección, el usuario sólo confirma y da "Crear Cliente".
5. Si un campo obligatorio del alta de cliente sigue vacío, se marca visualmente como "falta capturar" en lugar de mostrar un campo en blanco indistinguible.

## Ola 2 — Toda cotización nace ligada a una oportunidad real

1. Nueva función de base de datos transaccional que, en una sola operación, resuelve la etapa "Cotizando", reutiliza o crea el lead (deduplicado por email y por nombre normalizado de empresa), crea la oportunidad y escribe `oportunidad_id` en la cotización. Si algo falla, no queda nada a medias.
2. El wizard llama esa función en lugar de la cadena actual de 3–4 llamadas sueltas. Deja de ser "mejor esfuerzo".
3. Si aun así falla (por ejemplo, sin conexión), la cotización queda marcada como pendiente de vínculo y el detalle muestra un aviso con botón **"Ligar al CRM"** que reintenta.
4. **Regla nueva**: no se puede *enviar* al cliente una cotización de prospecto sin oportunidad ligada. Se valida en la base (no sólo en pantalla) con mensaje claro `LC_COT_SIN_OPORTUNIDAD`.
5. **Backfill**: función que recorre las cotizaciones de prospecto existentes sin oportunidad y las liga a un lead/oportunidad (reutilizando leads que ya coincidan por email/empresa). Se corre una vez y se reporta cuántas quedaron ligadas.

## Ola 3 — Cerrar el círculo

1. Al convertir el prospecto en cliente, la propagación al CRM (oportunidad + lead "Convertido") pasa a ser parte de la misma transacción, no un paso posterior que puede fallar en silencio.
2. Pantalla de Oportunidades y detalle de lead muestran las cotizaciones ligadas, ya sin huecos.
3. Vista de control para el gerente comercial: cotizaciones sin oportunidad (debe quedar en cero).

## Detalles técnicos

- **Migración A**: columnas `rfc`, `direccion`, `cp`, `pais` en `public.crm_leads` (nullable).
- **Migración B**: RPC `crm_vincular_cotizacion(p_cotizacion_id, p_prospecto jsonb, p_lead_id, p_oportunidad_id)` — `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated` (cumple H6/FIX-45), valida tenant con `rls_tenant_scope_ok()` y escritura con `puede_escribir_cotizaciones()`. Dedupe por `lower(trim(email))` y `_normalizar_razon_social(empresa)`.
- **Migración C**: guard en el cambio de estado de cotización a `Enviada`/`Solicitada`: si `es_prospecto` y `oportunidad_id IS NULL` → `LC_COT_SIN_OPORTUNIDAD` (registrar el código en el catálogo `lcCodeMessages`).
- **Migración D**: `crm_backfill_cotizaciones_sin_oportunidad()` restringida a `service_role`, idempotente.
- **Migración E**: extender `convertir_prospecto_a_cliente_rpc` para propagar cliente a oportunidad y lead dentro de la misma transacción; `propagarConversionProspectoCRM` queda como fallback para datos viejos.
- **Frontend**: nueva sección colapsable en `SeccionDestinatario.tsx` (campos fiscales del prospecto); `handlePaso1Crm.ts` / `vincularOCrear.ts` migran a la RPC única; `useCotizacionDetalleHandlers.abrirDialogConvertir` precarga desde el lead; banner de reintento en `CotizacionDetalleContenido.tsx`. Todos los archivos se mantienen ≤200 líneas (Power of 10) y sin `any`.
- **Pruebas**: SQL en `supabase/tests/` para la RPC de vínculo (idempotencia, dedupe, tenant ajeno, whitelist FIX-45), el guard de envío y el backfill; unitarias para la precarga del diálogo y la sección fiscal.
- **Versión**: bump de `APP_VERSION` + entrada en `CHANGELOG.md` por cada ola.
