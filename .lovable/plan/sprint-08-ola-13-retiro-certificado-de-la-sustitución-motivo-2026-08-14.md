# Sprint 08 (Ola 13) — Retiro certificado de la sustitución motivo 01 del REP archivado

## Qué está pasando hoy

Confirmado en el código: la función de borde `facturapi-cancelar-rep` acepta una bandera para "cancelar el REP archivado sustituyéndolo por el vigente", pero ningún punto de la app la envía nunca (el hook de cancelación llama con 3 datos y omite la bandera). Además, esa rama es inalcanzable: la validación que exige el UUID sustituto corre antes y devuelve error 400. Es una capacidad aparente que el usuario no puede usar.

Analogía: es como una puerta pintada en la pared — se ve, pero no abre.

## Decisión: Opción B (la recomendada por el propio sprint)

El SAT no permite volver a cancelar un CFDI ya cancelado para cambiarle el motivo, así que la sustitución 01 sobre un REP archivado no es ejecutable en la práctica. El cierre formal ya existe por otra vía: el archivo `rep_cancelado_facturapi_id/uuid` que se llena al re-timbrar, más la relación de sustitución declarada en el XML del REP nuevo.

Se retira la rama muerta y se certifica el retiro con pruebas. Si en el futuro el PAC confirma por escrito que acepta la sustitución 01 sobre un REP cancelado, se re-implementa completa (UI + captura + smoke en sandbox), no como bandera oculta.

## Alcance del cambio

1. Función de borde `facturapi-cancelar-rep`: quitar la bandera del contrato de entrada, su rama y las validaciones que sólo existían para ella; dejar el rechazo simple "ya cancelado". Se deja de leer y limpiar el archivo `rep_cancelado_*` desde aquí.
2. Servicio de frontend `repFacturapi`: quitar el cuarto parámetro y el campo del cuerpo de la petición. El hook de timbrado no cambia (ya usaba 3 parámetros).
3. Se conserva intacto: las columnas de archivo del REP cancelado y su llenado al re-timbrar, el flujo de re-timbrado con REP cancelado y el botón "Re-timbrar REP" de la celda de pago. Sólo se ajusta el texto del tooltip para no prometer la cancelación 01, dejando claro que el REP cancelado queda archivado como antecedente.
4. Nota documental del criterio fiscal de cierre en el CHANGELOG.

## Pruebas

- Test de certificación en la función de borde: ya no quedan rastros de la bandera ni de la rama, y los 3 tests estructurales vigentes siguen verdes sin cambios.
- Suite existente del servicio y del hook de timbrado en verde con la firma de 3 parámetros.
- Cierre del hueco de pruebas detectado antes: nueva suite SQL que verifique que la paginación del estado de cuenta de proveedor avanza hacia atrás en el tiempo (páginas 1 y 2 sin traslape ni movimientos perdidos), registrada en el grupo correspondiente de CI.

## Criterio de salida

- Cero ocurrencias de la bandera en la app y en las funciones de borde.
- Tests de la función de borde y del frontend en verde.
- Con esto quedan cerrados los 8 sprints de la Ola 13 en código: **GO sin condiciones**, dejando fuera sólo los pendientes que requieren acceso a servicios o insumo humano (smoke en sandbox del PAC, texto legal).

## Detalles técnicos

- Archivos: `supabase/functions/facturapi-cancelar-rep/index.ts`, `supabase/functions/facturapi-cancelar-rep/index_test.ts`, `src/features/facturacion/services/repFacturapi.ts`, `src/features/facturacion/components/detalle/PagoRepCell.tsx` (tooltip).
- Sin migraciones ni espejos de esquema: el bloque reservado `20260824080000` no se usa.
- Nueva suite `supabase/tests/rls/test_rls_proveedor_estado_cuenta_offset.sql` + registro en `.github/workflows/rls-tests.yml`.
- Cierre con `bun run audit:all`, tests Deno de la función de borde, `vitest` de los archivos tocados, bump de `APP_VERSION` a 13.602.0 y entrada en `CHANGELOG.md`.
- Rollback: revert del PR; el diff de la opción A queda documentado en el sprint si el PAC lo autoriza más adelante.
