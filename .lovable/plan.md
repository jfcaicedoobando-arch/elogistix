# Ola 13 — Qué falta para el GO sin condiciones

## Estado verificado hoy (v13.601.0)

| Sprint | Tema | Estado |
|---|---|---|
| S01 | Toolchain (knip, canario perf, `poolOptions` en la raíz de `test`) | Hecho (`vitest.config.ts` con `poolOptions` en raíz) |
| S02 | UX/frontend (mensajes, badges, fechas) | Hecho |
| S03 | Edge hardening (mensajes seguros, rate limit, timeouts SAT, timing-safe) | Hecho |
| S04 | Cobertura Ola 12 + `p_offset` + README de espejos | Hecho (migración `20260824040000`, `supabase/schema/README.md`, tests Deno) |
| S05 | Matriz `has_role` en tablas/storage de cliente y contactos | Hecho (`20260824050000`, suite `test_rls_expediente_cliente`) |
| S06 | Re-aplicación de guards en replay + guardrail `audit:replay-mirror` | Hecho (`20260824060000`, `20260824060100`, `scripts/audit-replay-mirror.ts`) |
| S07 | Org guard en `saldo_factura_proveedor` | Hecho (`20260824070000`, suite `test_rls_saldo_factura_proveedor`) |
| **S08** | **Sustitución motivo 01 del REP archivado (R4P-01, P2)** | **PENDIENTE — único sprint sin cerrar** |

Falta también un hueco de pruebas detectado al revisar: el arreglo de `p_offset` (R4BD-05) se aplicó en la base de datos pero **no tiene prueba SQL** que lo cubra; hoy sólo hay pruebas del lado del frontend que consumen la función.

## Qué hay que construir

### 1. Sprint 08 — limpiar el camino muerto de sustitución del REP archivado

Confirmado en el código: la función de borde `facturapi-cancelar-rep` acepta una bandera para "cancelar el REP archivado sustituyéndolo por el vigente", pero ningún punto de la aplicación la envía nunca (el hook de cancelación siempre llama con 3 datos y omite la bandera). Es una rama inalcanzable que aparenta una capacidad que el usuario no puede usar.

Se aplica la **opción B recomendada por el índice**: eliminar la rama muerta y dejar el flujo con un solo camino real y probado (cancelar con motivo 02, timbrar el REP nuevo). Si en el futuro el negocio necesita la sustitución 01 de un REP ya archivado, se implementa completa (UI + captura de UUID + smoke en sandbox), no como bandera oculta.

Alcance:
- Quitar la bandera y su rama de la función de borde, junto con las validaciones que sólo existían para ella.
- Quitar el parámetro correspondiente en la capa de servicio del frontend.
- Test de certificación: la función de borde rechaza la bandera obsoleta sin cambiar el comportamiento del flujo vigente (motivo 02 y motivo 01 normal con UUID sustituto siguen funcionando igual).

### 2. Cerrar el hueco de pruebas de `p_offset`

Nueva suite SQL que verifique que la ventana de paginación del estado de cuenta de proveedor avanza hacia atrás en el tiempo (páginas 1 y 2 sin traslape ni movimientos perdidos), registrada en el grupo correspondiente de las pruebas de CI.

### 3. Criterio de salida

- T1 (S06 + S07) y T2 (S01 + S05 + S08) en verde = **GO sin condiciones**.
- T3 (S02, S03, S04) ya está adelantado, por lo que tras S08 la ola queda completa en código.

## Pendientes que no bloquean el GO (requieren acceso a servicios o insumo humano)

- Smoke SQL del Sprint 10 en staging.
- Smoke en sandbox de Facturapi para retenciones (`withholding`).
- Texto legal UIB-08 y los ítems UIA-07/08 y N1 del master (insumos humanos).

## Detalles técnicos

- Archivos: `supabase/functions/facturapi-cancelar-rep/index.ts`, `src/features/facturacion/services/repFacturapi.ts`, `supabase/functions/facturapi-cancelar-rep/index_test.ts`.
- Nueva suite `supabase/tests/rls/test_rls_proveedor_estado_cuenta_offset.sql` + registro en `.github/workflows/rls-tests.yml`.
- S08 no toca migraciones ni espejos; si la prueba de `p_offset` requiriera reemitir la función, se usaría el bloque `20260824090000` conforme a la regla de oro (timestamp posterior + espejo 1:1 + `audit:manifest`/`audit:schema-functions`/`audit:replay-mirror` en PASS).
- Cierre con `bun run audit:all`, suite RLS del grupo afectado, tests Deno de la función de borde, bump de `APP_VERSION` a 13.602.0 y entrada en `CHANGELOG.md`.
