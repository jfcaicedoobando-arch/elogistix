-- perf(P4): saldos por cuenta agregados en SQL (antes: full scan client-side)
create or replace view public.v_saldos_cuentas_bancarias
with (security_invoker = on) as
select cuenta_bancaria_id,
       coalesce(sum(abono), 0)::numeric as total_abonos,
       coalesce(sum(cargo), 0)::numeric as total_cargos
from public.bbva_movimientos
group by cuenta_bancaria_id;

grant select on public.v_saldos_cuentas_bancarias to authenticated;
grant select on public.v_saldos_cuentas_bancarias to service_role;

-- perf(P5): índices de tenant/FK faltantes (auditoría 2026-07-25)
create index if not exists idx_clientes_org on public.clientes (organization_id);
create index if not exists idx_bbva_movimientos_org on public.bbva_movimientos (organization_id);
create index if not exists idx_bbva_movimientos_cuenta_fecha on public.bbva_movimientos (cuenta_bancaria_id, fecha desc);
create index if not exists idx_conceptos_venta_org on public.conceptos_venta (organization_id);
create index if not exists idx_conceptos_factura_org on public.conceptos_factura (organization_id);
create index if not exists idx_conceptos_factura_embarque on public.conceptos_factura (embarque_id);
create index if not exists idx_proveedor_facturas_conceptos_org on public.proveedor_facturas_conceptos (organization_id);
create index if not exists idx_proveedor_notas_credito_org on public.proveedor_notas_credito (organization_id);
create index if not exists idx_factura_embarques_org on public.factura_embarques (organization_id);
create index if not exists idx_embarques_org_created_at on public.embarques (organization_id, created_at desc);