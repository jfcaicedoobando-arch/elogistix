# Auditoría 3-3: qué quedó pendiente (Ola 9)

De los 26 hallazgos del reporte, la mayoría ya se cerró en las Olas 1–8 (NC multi-moneda, borrado físico de facturas, demo membership, aislamiento multi-tenant, cierre de periodo, three-way match, bloqueo optimista, fuga de costos, utilidad por cliente, correos duplicados, cronología, topes numéricos, filtros en URL).

Verificado hoy contra el código actual:

| Hallazgo | Estado real |
|---|---|
| H6 FKs de tenant, H7 reseed demo, L3 import CSV, L4 IVA código muerto | Ya resueltos |
| C1b Una sola fuente de saldo | Parcial: `cartera_pendiente` duplica la fórmula de NC en lugar de usar `saldo_factura` |
| M2 Factura USD nace con T/C = 1 | Pendiente |
| M4 Alta de cliente "facturable" incompleto vía API | Pendiente |
| M6 Parcheo de funciones con `replace(pg_get_functiondef())` | Pendiente (16 migraciones; 4 exentas en CI) |
| H8 CI de base limpia sin exenciones | Parcial (depende de `drift-anclas.txt`) |
| L1 Paginación sin desempate estable | Pendiente |
| L2 Edge function filtra mensaje crudo de error | Pendiente |

## Lo que propongo hacer (Ola 9)

1. **M2 — Tipo de cambio real en facturas USD (prioridad).** Hoy una factura en dólares nace con T/C = 1 y luego el timbrado la rechaza; el usuario queda con un borrador que no puede facturar. La conversión proforma→factura resolverá el T/C DOF de la fecha de emisión (con el mismo helper que ya usa embarques) y, si no hay T/C disponible, bloqueará la creación con un mensaje claro en vez de dejar un borrador roto.
2. **C1b — Un solo saldo.** `cartera_pendiente` dejará de repetir la fórmula y llamará a la función canónica de saldo, para que cobranza, estados y reportes de antigüedad siempre digan lo mismo.
3. **M4 — Alta de cliente por RPC.** Nueva RPC canónica de alta de clientes con validación fiscal según el tipo (prospecto vs facturable) y bloqueo del `insert` directo a la tabla; el módulo de Clientes y la importación masiva pasarán a usarla.
4. **L1 — Desempate estable.** Agregar `id` como criterio secundario de orden en bitácora, eventos y cierre de embarque, para que la paginación no repita ni salte registros.
5. **L2 — No filtrar detalles internos.** La función de timbrado devolverá un código estable de error y registrará el detalle solo en logs.
6. **M6 / H8 — Higiene de migraciones.** Reescribir las 4 migraciones ancladas como `CREATE OR REPLACE FUNCTION` completas y vaciar `drift-anclas.txt`, dejando el CI de base limpia sin exenciones. Además se documenta la regla: ninguna migración nueva puede parchear funciones con `replace()` de texto.

## Detalles técnicos

- Migración única `supabase/migrations/<ts>_ola9_auditoria3_3.sql`:
  - `convertir_proformas_a_factura`: reemplazar el literal `1` de `tipo_cambio` por `public.tc_dof_para_fecha(...)` (o helper equivalente ya existente), con `RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF'` si es NULL o ≤ 1.
  - `cartera_pendiente`: sustituir el `CASE` inline de NC por `public.saldo_factura(f.id)` / `public.nc_aplicadas_en_moneda_factura(f.id)`.
  - Nueva `public.crear_cliente(jsonb)` SECURITY DEFINER con validación de RFC/régimen/uso CFDI cuando `es_facturable`, más `REVOKE INSERT ON public.clientes FROM authenticated` y `GRANT EXECUTE` a los roles con alta.
  - Reescritura completa (sin `replace()`) de las funciones ancladas de las 4 migraciones exentas.
  - Sincronizar `supabase/schema/baseline.sql` y los archivos de `supabase/schema/**` afectados.
- Frontend: `src/features/cliente/services/crud.ts` e `importLote.ts` migran a la RPC; `bitacoraEmbarque.ts`, `eventos.ts`, `cierre.ts` añaden `.order("id", { ascending: false })`.
- Edge: `supabase/functions/facturapi-emitir/emitir.ts` → `{ error: "claim_failed" }` + `console.error` con `redact.ts`.
- CI: vaciar `supabase/tests/rls/drift-anclas.txt`; correr suite RLS y `audit:manifest`.
- Tests: caso de conversión proforma USD sin T/C (falla) y con T/C DOF (usa el valor correcto); caso de `crear_cliente` facturable sin RFC.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` (13.777.0).
