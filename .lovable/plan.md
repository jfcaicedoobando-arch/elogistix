## Objetivo

Cerrar los 3 huecos de trazabilidad y propagación cuando **N proformas de distintos embarques del mismo cliente** se fusionan en una sola factura:

1. **Trazabilidad línea → embarque** en la factura.
2. **Cabecera multi-embarque** (todos los embarques ligados, no solo el primero).
3. **Propagación de pago** de la factura hacia cada embarque involucrado.

Sin romper el flujo actual (proforma única sigue funcionando igual).

---

## Cambios de base de datos (una sola migración)

### A. Trazabilidad línea → embarque
Agregar a `public.conceptos_factura`:
- `embarque_id uuid REFERENCES embarques(id)` — opcional (NULL para conceptos manuales o consolidados MXN sin embarque puntual).
- `proforma_id_origen uuid REFERENCES proformas(id) ON DELETE SET NULL` — proforma de la que salió la línea.
- Índice `(factura_id, embarque_id)`.

### B. Cabecera multi-embarque
Nueva tabla puente `public.factura_embarques`:
- `factura_id uuid NOT NULL REFERENCES facturas(id) ON DELETE CASCADE`
- `embarque_id uuid NOT NULL REFERENCES embarques(id)`
- `organization_id uuid NOT NULL`
- PK compuesto `(factura_id, embarque_id)`.
- RLS + GRANTs estándar (authenticated CRUD via `has_org_access`, service_role ALL).
- Conservamos `facturas.embarque_id` como "embarque principal" (retrocompatibilidad con listados y filtros existentes).

### C. Propagación de pago
Nueva columna en `public.embarques`:
- `cobro_cliente_status text NOT NULL DEFAULT 'pendiente'` con CHECK en `('pendiente','parcial','pagado')`.
- `cobro_cliente_actualizado_at timestamptz`.

**No** tocamos el enum `estado_embarque` (es operativo: En Tránsito, Entregado, EIR…). El cobro es una dimensión independiente y así lo mantenemos.

### D. Trigger `trg_facturas_estado_a_embarques`
Trigger `AFTER UPDATE OF estado ON facturas`:
- Cuando `NEW.estado IN ('Pagada','Parcialmente pagada','Cancelada')` y cambió, recalcula el estado de cobro de cada embarque de `factura_embarques` así:
  - Para cada embarque, mira **todas sus facturas no canceladas** vía `factura_embarques`.
  - Si todas están `Pagada` → `pagado`.
  - Si alguna está `Pagada` o `Parcialmente pagada` → `parcial`.
  - Si ninguna → `pendiente`.
- Actualiza `cobro_cliente_status` + timestamp.

### E. RPC `convertir_proformas_a_factura` (actualización)
- Al hacer `INSERT INTO conceptos_factura`, poblar `embarque_id` y `proforma_id_origen` desde la proforma origen de cada línea (join a `conceptos_venta.proforma_id → proformas.embarque_id`).
- Para proformas **consolidadas** (`proforma_conceptos_consolidados`), guardar `embarque_id = NULL` pero sí `proforma_id_origen`.
- Después del `INSERT` de la factura, poblar `factura_embarques` con el `DISTINCT embarque_id` de las proformas seleccionadas.
- La cabecera `facturas.embarque_id` sigue guardando `v_first.embarque_id` como principal.

### F. Backfill
En la misma migración: poblar `factura_embarques` con `(id, embarque_id)` de facturas existentes que tengan `embarque_id NOT NULL`, para que la propagación funcione retroactivamente.

---

## Cambios de frontend (mínimos, presentación)

### 1. Detalle de factura (`FacturaDetallePage` / equivalente)
- En la tabla de conceptos, agregar columna **"Embarque"** con el `expediente` / `bl_master` cuando `embarque_id != NULL`. Enlace a `/embarques/:id`.
- Encabezado: en vez de "Embarque: EXP-123", mostrar chips con todos los embarques (query a `factura_embarques → embarques`) cuando hay >1.

### 2. Detalle de embarque
- Badge nuevo **"Cobro: Pendiente / Parcial / Pagado"** al lado del estado operativo, leyendo `cobro_cliente_status`.
- En la sección financiera, listar facturas ligadas vía `factura_embarques` (hoy solo se ve una).

### 3. Portal cliente factura
- Misma columna "Embarque" en el desglose (`PortalFacturaConceptosTable.tsx`) cuando el snapshot lo incluya.

**No hay cambios de lógica de negocio**: el estado se calcula server-side vía trigger.

---

## Verificación

- Tests unitarios del RPC (`convertirAFactura.test.ts`) extendidos con caso multi-embarque asertando `factura_embarques` y `conceptos_factura.embarque_id`.
- Test del trigger con `pg_tap` en `supabase/tests/rls/` (o script directo):
  - factura Pagada → embarques marcados `pagado`.
  - 2 facturas del mismo embarque, una Pagada → `parcial`.
  - factura Cancelada no cuenta.
- E2E `08-flujo-fiscal.spec.ts` extendido: registrar pago total → asertar badge de cobro en detalle de embarque.
- `tsgo` + `bun test` verdes.

---

## Detalles técnicos (para revisión de dev)

**Orden de la migración**:
```
1. ALTER TABLE conceptos_factura ADD embarque_id, proforma_id_origen
2. CREATE TABLE factura_embarques (+ GRANT + RLS + policies)
3. ALTER TABLE embarques ADD cobro_cliente_status, cobro_cliente_actualizado_at
4. CREATE OR REPLACE FUNCTION recalcular_cobro_embarques(embarque_ids uuid[])
5. CREATE TRIGGER trg_facturas_estado_a_embarques
6. CREATE OR REPLACE convertir_proformas_a_factura (versión nueva)
7. Backfill factura_embarques
```

**Retrocompatibilidad**:
- `facturas.embarque_id` se mantiene (evita reescribir filtros existentes en listados). Es el "principal" y sigue apuntando al primer embarque.
- Reportes existentes que agrupan por `embarque_id` en la cabecera siguen funcionando; los nuevos (línea a línea) usan `conceptos_factura.embarque_id`.

**Riesgos**:
- El trigger dispara en cada UPDATE de `facturas.estado` → mitigado con `WHEN (OLD.estado IS DISTINCT FROM NEW.estado)`.
- Facturas legacy sin `factura_embarques` → cubierto por el backfill.

## Archivos afectados (estimado)

- `supabase/migrations/<timestamp>_multi_embarque_factura.sql` (nuevo, ~200 líneas)
- `src/features/facturacion/components/*` — columna Embarque en tabla de conceptos (2-3 archivos)
- `src/features/embarques/components/*` — badge de cobro + lista de facturas (2 archivos)
- `src/features/portal/components/factura/PortalFacturaConceptosTable.tsx` — columna Embarque
- `src/features/proformas/services/__tests__/convertirAFactura.test.ts` — nuevo caso
- `CHANGELOG.md` + `appVersion.ts` bump
