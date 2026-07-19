# Fase P.1 — Modelo de Anticipos a proveedor (Ronda 4)

Fase O verificada en verde (45/45 tests: 8 nuevos + 37 de regresión L/M/N). El plan de Ronda 4 originalmente agrupaba en "Fase P" tres iniciativas grandes:

1. **Anticipos a proveedor** (pagos sin factura, aplicables después).
2. **Garantías re-evaluables** (dashboard, expiración, liberación automática).
3. **Matching parcial de PFC** (un pago se reparte entre varias facturas / conceptos).

Cada una toca tablas distintas y merece su propia migración + guardrails. Propongo dividirlas en **P.1 / P.2 / P.3** y arrancar con **P.1 (Anticipos)** porque es la base sobre la que se apoya el matching parcial de P.3.

## Problema actual (Bug: Anticipos crudos)
Hoy `pagos_proveedor` requiere `proveedor_factura_id NOT NULL`. Si Tesorería paga a un proveedor **antes** de recibir la factura (depósito, PO, retainer), no hay dónde registrarlo: los usuarios crean facturas "fantasma" en `Borrador` para tener contra qué cargar el pago, lo que rompe el estado real de CxP y contamina reportes.

## Objetivo Fase P.1
Permitir registrar pagos como **anticipos** (sin factura) y luego **aplicarlos** contra una o varias facturas cuando lleguen, con estado transaccional y saldos consistentes.

## Cambios

### 1. Migración `v13.301.87` — esquema
- Tabla nueva `public.anticipos_proveedor`:
  - `id`, `organization_id`, `proveedor_id NOT NULL`, `fecha_anticipo date`, `monto numeric(18,4) NOT NULL CHECK > 0`, `moneda public.moneda_enum`, `tipo_cambio_usd numeric(18,6)`, `metodo_pago text`, `referencia text`, `cuenta_bancaria_id uuid`, `notas text`, `estado text CHECK IN ('disponible','aplicado_parcial','aplicado_total','cancelado') DEFAULT 'disponible'`, `saldo_disponible numeric(18,4)`, `created_by uuid`, `deleted_at`, `deleted_by`, timestamps.
  - Grants: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` (ALL). Sin acceso `anon`.
  - RLS: SELECT/INSERT/UPDATE/DELETE restringidos por `organization_id = current_user_org_id() OR has_role(auth.uid(),'super_admin')`.
- Tabla nueva `public.anticipos_aplicaciones` (bridge many-to-many anticipo↔factura):
  - `id`, `organization_id`, `anticipo_id NOT NULL REFERENCES anticipos_proveedor(id)`, `proveedor_factura_id NOT NULL REFERENCES proveedor_facturas(id)`, `pago_proveedor_id NOT NULL REFERENCES pagos_proveedor(id)` — cada aplicación materializa un `pagos_proveedor` con `es_anticipo_aplicado=true` para que el recálculo N y el trigger de sobrepago funcionen sin cambios adicionales.
  - `monto_aplicado numeric(18,4) NOT NULL CHECK > 0`, `moneda_aplicada`, `fecha_aplicacion date`, `created_by`, timestamps.
  - RLS y grants idénticos.
- Añadir columna `pagos_proveedor.es_anticipo_aplicado boolean NOT NULL DEFAULT false` para identificarlos.

### 2. RPCs (misma migración)
- `public.registrar_anticipo_proveedor(...)` — inserta en `anticipos_proveedor`, valida rol (`admin`/`admin_org`/`contador`/`tesorero`/`super_admin`), guarda bitácora, devuelve la fila.
- `public.aplicar_anticipo_a_factura(p_anticipo_id, p_factura_id, p_monto)` — SECURITY DEFINER:
  1. Valida rol y `saldo_disponible ≥ p_monto` (tolerancia 0.01).
  2. Valida que la factura esté `aprobada` y no `Cancelada`.
  3. Convierte monto a la moneda de la factura vía `convertir_monto_pago_a_factura` (Fase L).
  4. Inserta `pagos_proveedor` con `es_anticipo_aplicado=true` — dispara triggers N (recálculo estado) y sobrepago automáticamente.
  5. Inserta `anticipos_aplicaciones`.
  6. Recalcula `saldo_disponible` y `estado` del anticipo.
  7. Bitácora.
- `public.cancelar_anticipo_proveedor(p_id, p_motivo)` — sólo si `saldo_disponible = monto` (sin aplicaciones), soft delete + bitácora.
- Grants restringidos: `REVOKE ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated, service_role`.

### 3. Trigger `trg_anticipo_saldo` en `anticipos_aplicaciones`
AFTER INSERT/UPDATE/DELETE → recalcula `saldo_disponible = monto - SUM(aplicaciones vivas)` y ajusta `estado` (`disponible` / `aplicado_parcial` / `aplicado_total`). Respeta `cancelado`.

### 4. Cliente
- Nuevo servicio `src/features/cxp/services/anticipos.ts` — `registrarAnticipo`, `aplicarAnticipo`, `cancelarAnticipo`, `listAnticiposPorProveedor` con validaciones de entrada y mapeo de errores estilo `aprobacionFactura.ts`.
- **Sin UI nueva en esta fase** — sólo servicio + RPCs. La UI (modal "Aplicar anticipo" en el detalle de factura y sección "Anticipos" en `ProveedorDetalle`) queda para fase de UX aparte, para no mezclar riesgo. El servicio es probado con tests unitarios.

### 5. Tests
- Guardrail SQL `src/lib/__tests__/anticipos-fase-p1.test.ts` (~10 asserts):
  1. Tablas `anticipos_proveedor` y `anticipos_aplicaciones` existen con grants correctos.
  2. RLS habilitada en ambas.
  3. Policies scoped por `organization_id`.
  4. `pagos_proveedor.es_anticipo_aplicado` existe con default false.
  5. `aplicar_anticipo_a_factura` es SECURITY DEFINER con `search_path=public`.
  6. RPCs revocadas de PUBLIC/anon.
  7. Trigger `trg_anticipo_saldo` en `anticipos_aplicaciones`.
  8. RPC valida rol (busca cascada `has_role`).
  9. RPC valida saldo con tolerancia 0.01.
  10. `cancelar_anticipo_proveedor` bloquea si hay aplicaciones vivas.
- Unit tests `anticipos.test.ts` — validaciones de entrada + mapeo de errores (5 códigos: `LC_ANTICIPO_SIN_SALDO`, `LC_ANTICIPO_FACTURA_INVALIDA`, `LC_ANTICIPO_YA_CANCELADO`, `LC_ANTICIPO_SIN_ROL`, mapeo genérico).
- Regresión: correr guardrails L/M/N/O para asegurar que triggers de recálculo aceptan pagos con `es_anticipo_aplicado=true` sin efectos raros.

### 6. Versionado y changelog
- `APP_VERSION` → `13.301.87`.
- Entrada extensa en `CHANGELOG.md` documentando: modelo, RPCs, triggers, bitácora, y qué queda fuera de alcance (UI + P.2 + P.3).

## Verificación
```
bun run ci:fast
```
Todo verde, 45 asserts L–O + 10+5 nuevos de P.1.

## Roadmap resto de Ronda 4
- **Fase P.2** — Garantías re-evaluables (dashboard, expiración, `estado` machine, auto-liberación al llegar `fecha_limite_devolucion` sin cargos).
- **Fase P.3** — Matching parcial PFC: un pago se puede repartir entre varias facturas del mismo proveedor con una sola operación transaccional.
- **Fase Q** — UI de anticipos y garantías (modales, listados, badges).

## Fuera de alcance P.1
- UI de aplicación de anticipos (queda para Fase Q).
- Anticipos multi-moneda con cruces EUR (misma limitación que Fase L: `LC_PAGO_CRUCE_NO_SOPORTADO`).
- Reversar una aplicación individual (por ahora, si hay error se soft-deletea el `pagos_proveedor` correspondiente y el trigger recalcula el saldo del anticipo).
