# Revisión Fase E + plan Fase F

## Estado actual de Fase E

**Server-side (verde):** `eliminar_embarque_completo` bloquea con `LC_EMBARQUE_BLOQUEADO` cuando hay facturas vivas, CxP, pagos, NCs, comisiones definitivas o cerrado; nunca soft-deletea `facturas`/`proveedor_facturas`; escribe `bitacora_actividad`.
**Cliente (verde):** `EmbarqueBloqueadoError` tipado, `DialogEliminarEmbarque` reutiliza el modal de bloqueo con motivos del server.
**Guardrails (verde):** 8 asserts nuevos + parseo del error en `mutations.test.ts` (25/25 tests).

**Rojos de CI reales tras Fase E:**
| # | Fallo | Causa | Regresión Fase E |
|---|---|---|---|
| 1 | `DialogEliminarEmbarque` complexity 18 (max 16) | El `try/catch` con `EmbarqueBloqueadoError` + estado `bloqueoServidor` + rama `depsBloqueado` | Sí |
| 2 | `DataTable.tsx` = 236 líneas > 200 (Power of 10) | Refactor previo (extracción `HorizontalScrollFades`) quedó insuficiente | No — se destapó ahora |
| 3 | `useActualizarPlantilla` timeout 15 s | Flake en full-suite bajo carga (pasa aislado en 733 ms) | No |

No propago Fase F hasta cerrar (1) y (2). El flake (3) se documenta pero no se toca aquí — corresponde a un pase separado de estabilidad de suite.

---

## Paso 0 — Hotfix CI Fase E (v13.301.74a)

### 0.1 `DialogEliminarEmbarque.tsx` — bajar ciclomática ≤ 16
- Extraer la rama **"bloqueado"** a un subcomponente local `DialogEmbarqueBloqueadoWrapper` (recibe `expediente`, `deps`, `onClose`) — elimina 1 branch grande del render principal.
- Extraer el `try/catch` de `handleEliminar` a un helper `ejecutarEliminacion(embarque, deps auxiliares)` que devuelva `{ ok } | { bloqueo }` — reduce 2-3 aristas del cuerpo del componente.
- El adaptador `motivosADependencias` sale a `./eliminar/adaptadores.ts` (fuera del componente).

### 0.2 `DataTable.tsx` — bajar a ≤ 200 líneas
- Extraer **`useHorizontalScrollFades` + `HorizontalScrollFades`** (que ya vive en el mismo archivo) a `src/components/shared/DataTableScrollFades.tsx`.
- Si sobran líneas, mover `renderPagination` a `DataTablePagination.tsx` (ya existe patrón similar).
- Verificar que ningún test importa por ruta interna; si sí, re-exportar desde `DataTable.tsx`.

### 0.3 Validación
- `bun run lint -- --max-warnings 0` → 0 warnings.
- `bunx vitest run src/lib/__tests__/architecture-baseline.test.ts` → passing.
- `bun run ci:fast` completo → verde (excepto el flake conocido).

---

## Paso 1 — Fase F: Bugs 8, 10, 11 (candados de pagos, REP y NCs)

Recap de los bugs de la Ronda 2 (los abordo en un solo migration + código porque comparten la noción "factura viva = `saldo_factura(id) > 0`" ya introducida en Fase D):

### Bug 8 — `pagos_factura` acepta pagos sobre facturas no-vivas
Hoy se puede insertar/actualizar `pagos_factura` apuntando a una factura `Cancelada`, `Sustituida` o `Borrador`. Rompe la conciliación (`recalcular_cobro_embarques`) y contamina Profit.
**Fix:** trigger `BEFORE INSERT OR UPDATE` en `pagos_factura` que rechaza si:
- la factura está en `('Cancelada','Sustituida','Borrador')`, o
- el `monto_aplicado_factura` empujaría `saldo_factura(factura_id) < -0.01` (sobrepago).
Mismo trigger espejo en `pagos_proveedor` contra `proveedor_facturas` (`Cancelada` / borrador).

### Bug 10 — REP (complemento de pago) se puede timbrar sobre factura no viva
`pagos_factura.rep_uuid` puede existir aunque la factura padre ya no lo esté. Riesgo fiscal: el SAT lo rechaza.
**Fix:** trigger `BEFORE INSERT OR UPDATE OF rep_uuid, rep_estado` que exige `f.estado IN vivos` y `factura.uuid IS NOT NULL` (la factura debe estar timbrada). Además, en `factura_notas_credito` bloqueamos aplicar NC a factura no viva (ya existía la regla de "liquidada" desde v13.301.40 — la unificamos con `saldo_factura`).

### Bug 11 — NCs se pueden aplicar más allá del saldo real
Hoy `factura_notas_credito.monto` no valida contra `saldo_factura` — se puede aplicar NC por más que el saldo pendiente, dejando saldo negativo.
**Fix:** trigger `BEFORE INSERT OR UPDATE` en `factura_notas_credito` que rechaza si `SUM(nc.monto) > saldo_factura_bruto(factura_id)` (donde bruto = total − pagos vivos, sin restar la propia NC que se está insertando). Error message: `'NC excede saldo pendiente'`.

### Estructura de la migración (una sola)
```sql
-- 20260718_HHMMSS_fase_f_candados_pagos_rep_nc.sql
CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago() ...
CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_rep() ...
CREATE OR REPLACE FUNCTION public.assert_nc_no_excede_saldo() ...
CREATE OR REPLACE FUNCTION public.assert_proveedor_factura_viva_para_pago() ...

CREATE TRIGGER trg_pago_factura_viva BEFORE INSERT OR UPDATE ON pagos_factura ...
CREATE TRIGGER trg_pago_factura_rep_viva BEFORE INSERT OR UPDATE OF rep_uuid, rep_estado ON pagos_factura ...
CREATE TRIGGER trg_nc_no_excede_saldo BEFORE INSERT OR UPDATE ON factura_notas_credito ...
CREATE TRIGGER trg_pago_proveedor_factura_viva BEFORE INSERT OR UPDATE ON pagos_proveedor ...
```

### Cliente
- `useRegistrarPago.ts` / `useAplicarNotaCredito.ts` / `useTimbrarREP.ts`: parsear los mensajes de los triggers y mostrar toasts entendibles (`"Esta factura ya no acepta pagos porque fue sustituida/cancelada"`, `"La nota de crédito excede el saldo pendiente ($X)"`).
- En `FacturaDetalle.tsx` deshabilitar los botones "Registrar pago" / "Timbrar REP" / "Nueva NC" cuando `estado ∈ {Cancelada, Sustituida, Borrador}` o `saldo ≤ 0.01`, con tooltip explicando por qué.

### Guardrails nuevos
- `src/lib/__tests__/candados-pagos-rep-nc-fase-f.test.ts` — assets estáticos sobre la migración:
  - Los 4 triggers existen y apuntan a la tabla correcta.
  - Cada `assert_*` incluye la lista `('Cancelada','Sustituida','Borrador')` (o el subset aplicable).
  - `assert_nc_no_excede_saldo` compara contra `saldo_factura` o su versión bruta.
  - `assert_factura_viva_para_rep` valida `uuid IS NOT NULL`.
- Tests unitarios de los hooks: mock del error de Postgres y verificación del mapeo a mensaje amigable.

### Riesgos y mitigaciones
- **Datos existentes rotos**: puede haber pagos/REP/NCs históricos que hoy violarían los triggers. **Mitigación**: los triggers son `BEFORE INSERT OR UPDATE`, no `CHECK`, así que los históricos no se re-validan. Antes del `CREATE TRIGGER`, corro una query diagnóstica que lista offenders y los reporto al usuario para decidir si limpiar o no.
- **Formularios internos** que hacen `UPDATE` benigno (ej. recalcular `rep_estado`): revisar antes de habilitar; si necesario, `WHEN (NEW.<col> IS DISTINCT FROM OLD.<col>)` para no re-validar en updates no relevantes.

### Versión y changelog
- Bump `APP_VERSION` a **13.301.75**.
- Entrada nueva en `CHANGELOG.md`.

## Detalles técnicos (referencia para el implementador)

- `saldo_factura(uuid)` ya existe (Fase D) y devuelve `total − pagos_vivos − NCs_aplicadas`, con 0 para Cancelada/Sustituida/Borrador. Para NC-vs-saldo necesitamos la versión **bruta** (sin restar la NC en curso). Se crea `saldo_factura_bruto(uuid)` que replica la fórmula pero omite `factura_notas_credito`, y `assert_nc_no_excede_saldo` compara `SUM(NCs vivas + NEW.monto) ≤ saldo_bruto`.
- Los triggers usan `RAISE EXCEPTION` con `ERRCODE = 'check_violation'` y `HINT` con JSON estructurado (mismo patrón que Fase E) para que el cliente pueda parsearlos si se necesita en el futuro.
- No se toca `client.ts` ni `types.ts` autogen.

## Entregables

- 1 migración SQL (Fase F).
- Ediciones en `src/features/facturacion/hooks/**` para mapeo de errores.
- 1 archivo nuevo de guardrails + updates a hook-tests existentes.
- `CHANGELOG.md` y `APP_VERSION` actualizados.
- `bun run ci:fast` verde (excluyendo el flake conocido).
