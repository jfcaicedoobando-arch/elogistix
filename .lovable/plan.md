## Respuesta corta

No. Del inventario cruzado (documento de instrucciones ↔ repo), sólo ~10 de los 49 fixes tienen un test que ejercite exactamente el comportamiento corregido:

- **Con test**: B-067+B-072, B-071, B-079 (suite nueva `test_rls_reg_costeo.sql`), B-082 (`facturaSaldo.test.ts`), B-068+B-076, B-075, B-092, B-083+B-106.
- **Cobertura parcial / genérica** (el archivo tiene tests, pero no del hunk del fix): REG B-001, B-069, B-077, B-099, B-105, B-098.
- **Sin ningún test**: el resto (~30 IDs), incluidos varios de dinero y seguridad: REG B-016, REG B-004, B-064, B-065, B-066, B-070+B-084, B-080, B-085, B-090, B-073, B-074, B-089, B-091, B-096, B-078, B-081/B-093/B-101, B-086+B-095, B-087+B-094, B-100, B-102, B-103, B-104.

Nota: "existe archivo de test que menciona el símbolo" no es lo mismo que "cubre la rama del bug"; los marcados como parciales requieren leer los asserts contra el diff antes de darlos por cerrados.

## Plan: 3 olas de cobertura, por riesgo

### Ola 1 — Dinero y seguridad (SQL, mayor riesgo de regresión silenciosa)
Nueva suite `supabase/tests/rls/test_rls_reg_portales.sql` (registrada en la matriz de `rls-tests.yml`):
- **B-065 + B-090**: `get_top_tarifas` invocada por un usuario de Org B no devuelve tarifas de Org A; con dos tarifas de igual total, el orden es determinista.
- **B-080**: agente inactivo desaparece del Top-3.
- **B-069**: un usuario con rol `agente_carga` no lee `conceptos_venta` / `facturas` de la organización.
- **B-070 + B-084**: el agente sólo ve su propio registro en `costeo_agentes`.
- **B-085**: `storage.objects` del bucket de cartas de garantía filtra por organización.
- **B-064**: `_crear_embarque_replicar_conceptos` con 3 contenedores no multiplica el costo unitario.
- **REG B-016**: `duplicar_cotizacion` corre sin error y copia conceptos.
- **B-066**: `agente_aprobar_tarifa` existe con una sola firma y aprueba un borrador.
- **B-098**: `current_agente_id` / `get_current_agente_context` resuelven determinista con dos vínculos.
- **REG B-001**: `UPDATE ... SET deleted_at = now()` funciona en una muestra de las 27 tablas y la fila deja de listarse.

### Ola 2 — Lógica pura de frontend (vitest, barato y estable)
- `demorasTramos.test.ts` (B-096): solapes, tramo abierto, límites.
- `dateOnly.test.ts` (B-089/B-103): fechas date-only sin desfase horario en México.
- `TarifaCardBadges.test.tsx` (B-091): copy dinámico según días libres; badge ausente si faltan datos.
- `buildCostosDesdeTarifa` / payload del wizard (B-073, B-074): vínculo tarifa→costos y regeneración de conceptos al hacer override.
- `estadoCuentaAggregates.test.ts` (B-077, B-105): casos multi-moneda y "Por vencer ≤ 7 días".
- `cotizacionDetalle` + columnas del portal (B-081, B-099, B-093): total con IVA y parseo de conceptos.

### Ola 3 — Componentes de portal y agente (RTL, humo dirigido)
Tests de render con datos mockeados que afirman el texto/estado corregido, no el layout:
- Portal cliente: B-101, B-102, B-103, B-104, B-106.
- Portal agente: B-086+B-095 (columnas y estados de tarifa), B-087+B-094 (KPIs sin reemplazadas ni cerrados), B-078 (contexto de agente).
- CRM: REG B-004 (menú "+ Nuevo" renderiza sus items).
- B-097, B-100: copy y grid de mercancía.

## Notas técnicas
- Las suites SQL siguen el patrón existente (`_helpers.sql`, `pg_temp.as_user`, `ROLLBACK` final) y deben añadirse a `matrix.suite` en `.github/workflows/rls-tests.yml`, si no el validador de CI falla.
- Los tests de RPC de la Ola 1 son de comportamiento, no de RLS puro; van en la misma suite para reutilizar el seed multi-tenant.
- Cada ola cierra con `bun run lint -- --max-warnings 0` y la corrida de las suites tocadas; bump de `APP_VERSION` + entrada en `CHANGELOG.md` por ola.
- Si un test revela que un fix quedó incompleto (posible en B-073/B-074), se corrige el código en la misma ola y se anota en el changelog.

## Alcance
Sólo se añaden tests y, si algún test descubre un fix incompleto, la corrección puntual. No se rediseña nada más.
