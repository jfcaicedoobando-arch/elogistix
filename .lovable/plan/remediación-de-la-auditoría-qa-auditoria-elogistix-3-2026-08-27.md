# Remediación de la auditoría QA (auditoria_elogistix_3)

Revisé los hallazgos contra la base real. Los principales están confirmados, uno está mal descrito y otro ya no aplica tal cual. La remediación se entrega en olas, empezando por dinero y seguridad.

## Lo que verifiqué en la base antes de planear

- **C1 confirmado.** `recalcular_estado_factura` y `saldo_factura_bruto` restan `nc.monto` en crudo, sin convertir moneda. Ya existe la función canónica correcta (`nc_aplicadas_en_moneda_factura`), que sí convierte con el T/C de la NC y de la factura, pero esas dos no la usan. Efecto real: una factura MXN saldada con NC en USD sigue viéndose "Emitida" con saldo pendiente.
- **C7 confirmado (y peor de lo descrito).** `ensure_demo_membership(uuid)` es `SECURITY DEFINER` con `EXECUTE` para `authenticated`: cualquier usuario logueado puede pasar el id de otra persona y reescribir su rol global a `admin_org` y su organización a la demo.
- **C6 confirmado.** La política `Tenant delete facturas` permite DELETE físico a `operador`, `contador`, `admin_org` y `admin`, y el rol `authenticated` tiene el privilegio DELETE otorgado.
- **C8 confirmado.** No existe ningún índice sobre `uuid_fiscal` en `facturas`: dos facturas pueden compartir el UUID del SAT.
- **C9 parcialmente confirmado.** `dashboard_summary` y `dashboard_details` son `SECURITY DEFINER` ejecutables por `authenticated` sin ningún filtro de rol. En `cotizacion_costos` la política de lectura sí es amplia (`puede_escribir_cotizaciones`, que incluye vendedor y pricing).
- **C2/C3/C4/C5, H1–H8, M1–M8:** no los ejecuté contra la base todavía; son afirmaciones estáticas del auditor. Cada ola empieza con una prueba SQL que reproduce el hallazgo antes de tocar código, para no "arreglar" algo que ya esté cubierto por otro trigger (ya pasó con L4, que el propio auditor refutó).

## Ola 1 — Dinero y seguridad (inmediato)

1. **Fuente única de saldo (C1 + C1b).** `recalcular_estado_factura`, `saldo_factura_bruto` y `cartera_pendiente` pasan a usar `nc_aplicadas_en_moneda_factura`. Se agrega una prueba SQL de regresión con el caso exacto del auditor (factura MXN 1,160 + NC USD 58 @20 → saldo 0, estado `Pagada`) y una prueba que compara las tres fuentes de saldo para la misma factura.
2. **`ensure_demo_membership` (C7).** `REVOKE EXECUTE FROM authenticated`; queda sólo `service_role` (la edge function `demo-access` ya corre con esa credencial) y se añade guard interno que rechaza si el invocador no es service_role. Prueba de ACL en la suite FIX-45.
3. **DELETE físico de facturas (C6).** `REVOKE DELETE ON public.facturas`, se elimina la política de DELETE y se agrega trigger que prohíbe el borrado físico. Se expone `soft_delete_factura(id, motivo)` con bitácora, y el rollback del frontend (`facturaManual.ts`) pasa a una RPC atómica en vez de `.delete()`.
4. **`uuid_fiscal` (C8).** Índice único parcial `(organization_id, uuid_fiscal)` y ampliación de `bloquear_modificacion_factura_emitida` para blindar `uuid_fiscal`, `facturapi_id`, `xml_url` y `pdf_url` salvo service_role/webhook. Antes de crear el índice, se corre un conteo de duplicados existentes y, si hay, se reportan en lugar de fallar la migración a ciegas.
5. **Costos y utilidad por API (C9).** Guard de rol (`COST_VIEWERS`) dentro de `dashboard_summary`/`dashboard_details`: a quien no puede ver costos se le devuelve el payload sin `costo`, `profit` ni `margen`. En `cotizacion_costos` se separa la política de SELECT para que sólo la satisfagan los roles con visibilidad de costos.

## Ola 2 — Aislamiento entre organizaciones (C2, C3, C4, C5, H6)

Patrón único: `UNIQUE (id, organization_id)` en las tablas padre (`clientes`, `embarques`, `proveedor_facturas`, `facturas`, `cotizaciones`) y llave foránea compuesta en las hijas, con FKs de `organization_id` → `organizations` donde faltan. Donde la FK compuesta sea inviable por datos históricos, trigger `BEFORE INSERT/UPDATE` que compara tenants. Se refuerzan además `crear_embarque_completo` (bloqueo del cliente por org), `crear_proforma_atomica` (los conceptos deben ser del mismo embarque y cliente) y `guard_pago_proveedor` (comparar org de pago y factura). En la edge function `facturapi-emitir/contexto.ts`, que usa credencial de servicio y salta RLS, se valida explícitamente que cliente y factura sean de la misma organización.

## Ola 3 — Controles de proceso (H1–H4)

- **Cierre de periodo fiscal (H1):** tabla `fiscal_periods(organization_id, anio, mes, estado)` con RPC de cierre/reapertura restringida a contador/admin, y guards en los triggers de facturas, pagos, NC y CxP que rechazan movimientos en periodo cerrado.
- **Match CxP (H2):** antes de aprobar una factura de proveedor se compara su importe contra los `conceptos_costo` del embarque vinculado con tolerancia configurable; sin vínculo se exige justificación escrita registrada en bitácora.
- **Cotización aceptada inmutable (H3):** una cotización `Aceptada` deja de ser editable (todo cambio genera nueva versión) y la conversión a embarque lee el snapshot de `cotizacion_versiones`, no el JSON vivo.
- **Conceptos `en_proforma` (H4):** sólo los conceptos `pendiente` son editables; modificar uno ya proformado exige revertir la proforma.

## Ola 4 — Concurrencia y deuda (H5, H7, H8, M1–M8, L1–L3)

Bloqueo optimista (`expectedUpdatedAt`) extendido a CxP, Tesorería y contactos de proveedor; reseed demo con borrado en orden de dependencias; T/C real al convertir proforma USD a factura (M2); `NULLIF` fail-closed y resta de NCs en `profit_por_cliente` (M1); normalización y unicidad de correos (M3); topes y esquema zod compartido de montos (M7); filtros en la URL en los listados grandes (M8); desempate estable de paginación (L1); dejar de filtrar mensajes crudos de la base al cliente (L2); reporte de fallo parcial en importaciones (L3). Se borra el código muerto de IVA agregado que el auditor ya refutó (L4).

## Detalles técnicos

- Cada ola: migración por hallazgo (nunca parches con `replace()` de texto — causa raíz de M6), sincronización de `supabase/schema/baseline.sql` y del manifiesto de migraciones, prueba SQL en `supabase/tests/` que falla antes del fix, y `CHANGELOG.md` + bump de `APP_VERSION`.
- Se respetan los contratos vigentes: FIX-45 (ninguna función `SECURITY DEFINER` nueva ejecutable por `anon`), H6 de higiene de permisos, RLS `RESTRICTIVE` de la Ola 16 y las reglas Power of 10 en el código nuevo del frontend.
- El frontend cambia sólo donde el backend lo obliga: rollback de factura manual, payload de dashboard sin costos, banners de periodo cerrado y avisos de conflicto de concurrencia.
- Los hallazgos "UNTESTED" del reporte (timbrado real con el PAC y flujos E2E de interfaz) quedan como verificación manual al final de la Ola 1, con la suite E2E existente.

## Entrega sugerida

Ola 1 primero y sola: es la única que cambia números que hoy están mal en operación y cierra dos huecos de seguridad. Las olas 2 a 4 se van tomando en orden después de validar la 1.
