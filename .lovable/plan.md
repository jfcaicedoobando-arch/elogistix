# Cierre de la auditoría de lógica de negocio — hallazgo 8

De la auditoría anterior quedaron 2 puntos sin cerrar (los marqué como "pendientes de confirmar"). Ya los verifiqué contra el código y contra la base de datos real. Los dos son bugs reales.

## 1. Los días de demora del tablero no cuadran con los que se facturan

Hoy existen **dos calculadoras de demoras distintas** que dan números diferentes para el mismo contenedor:

| | Detalle del embarque (lo que se cobra) | Tablero / alertas (lo que ve el operador) |
|---|---|---|
| Fecha base | Descarga y devolución **reales** | **ETA** (fecha planeada) |
| Días libres | Los de la naviera, con override por contenedor | **7 fijos para todos** |
| Tarifa | Tabulador escalonado por tramos | No aplica montos |
| Fecha "hoy" | Fecha del documento | `current_date` = **UTC** |

Analogía: el tablero mide con una regla de plástico genérica y la factura con vernier. Ambos dicen "días de demora" pero no son la misma cosa, y el operador pierde confianza en la alerta.

Además la base corre en UTC: hoy `current_date` devuelve 28/08 cuando en México todavía es 27/08. Verificado en la base: **cada noche, entre 18:00 y 24:00 hora de México, el tablero cuenta un día de demora de más.**

### Qué se va a hacer
- Cambiar `v_hoy` del tablero a la fecha de México (mismo patrón que ya usan otras funciones del sistema): elimina el día fantasma.
- Sustituir los 7 días libres fijos por los días libres reales del embarque (override del contenedor → condición de la naviera → 7 como último recurso).
- Usar la fecha real de descarga cuando exista; sólo caer a la ETA si el embarque aún no tiene evento de descarga registrado, y marcar en el dato si es estimado o real.
- En la tarjeta de alertas, distinguir visualmente "estimado (por ETA)" de "real (por descarga)" con un `Hint`, sin cambiar la maquetación.

## 2. Notas de crédito de proveedor: pueden restar pesos contra dólares

Las notas de crédito de **cliente** ya convierten bien (heredan moneda y T/C de la factura y hay candado que bloquea si no se puede convertir).

Las notas de crédito de **proveedor** no: la tabla no tiene columna de tipo de cambio y el saldo suma `monto` en crudo. Si se captura una NC de 1,000 MXN contra una factura en USD, el sistema resta 1,000 **dólares** de saldo. Es como pagar una cuenta en dólares con billetes de pesos y que la caja los cuente uno a uno como dólares.

Verificado en la base: **hoy no existe ninguna NC de proveedor con moneda distinta a su factura (0 de 0 registros)**, así que el arreglo es preventivo y no requiere corregir datos históricos.

### Qué se va a hacer
- Agregar `tipo_cambio` a las notas de crédito de proveedor, con el mismo anclaje al T/C oficial DOF de la fecha del documento que ya usan las facturas.
- Candado en base de datos (espejo del que ya existe para NC de cliente): si la moneda de la NC difiere de la de la factura, exigir T/C convertible; si no, rechazar con `LC_NC_PROV_MONEDA_NO_CONVERTIBLE`.
- Convertir a la moneda de la factura en `saldo_factura_proveedor()` y en la vista `v_proveedor_facturas_saldo`, con la misma cascada defensiva que la NC de cliente (si no se puede convertir, **no** resta — mejor un saldo alto que dar por pagada una factura que no lo está).
- En el formulario de NC de proveedor, heredar la moneda de la factura por defecto y mostrar el T/C aplicado con la convención mexicana ("MXN por 1 USD").

## Detalles técnicos

**Migración 1 — demoras del tablero**: reemitir `public._dashboard_details_calc` (espejo canónico en `supabase/schema/`): `v_hoy := (now() AT TIME ZONE 'America/Mexico_City')::date`; CTE con `LEFT JOIN` a `embarque_contenedores.dias_libres_override` y `costeo_navieras_condiciones.dias_libres_demoras_default`; `LEFT JOIN LATERAL` al último `eventos_embarque` de tipo `Descarga` (con `deleted_at IS NULL`) para la fecha base; nuevos campos JSON `diasLibres` y `baseDemora` (`'real' | 'eta'`).

**Migración 2 — NC de proveedor**: `ALTER TABLE public.proveedor_notas_credito ADD COLUMN tipo_cambio numeric`; trigger `_nc_prov_tc_dof_obligatorio()` (patrón de `_factura_tc_dof_obligatorio`, vía `tc_dof_vigente`); trigger `_guard_nc_prov_moneda_convertible()`; reemisión de `saldo_factura_proveedor()` y `v_proveedor_facturas_saldo` con conversión. Sin `GRANT` nuevos: los helpers quedan `service_role`/internos y se registran en `supabase/tests/rls/_ci_service_role_only.sql` (regla que ya tumbó CI antes).

**Frontend**: parsers de `dashboardTypes.ts` para los campos nuevos; `AlertasDemoraCard.tsx` y `miOperacionUtils.ts` para el `Hint` de estimado/real; formulario de NC de proveedor en `src/features/compras/` para moneda heredada y T/C visible; nuevo código en `lcCodeMessages`.

**Cierre obligatorio**: `bun run db:release-manifest:update`, regenerar `supabase/schema/baseline.sql` desde el replay, correr suites RLS + unitarias, bump de `APP_VERSION` a `13.779.0` y entrada en `CHANGELOG.md`.
