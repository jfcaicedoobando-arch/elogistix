# Permitir proformas a Coordinador Logístico y Gerente de Operaciones

## Por qué Alan no puede generar la proforma

El expediente ELIMP00405 sí existe en su empresa y su cuenta tiene el rol **Coordinador Logístico**.

- La base de datos **sí lo autoriza**: en sus reglas, coordinador logístico y gerente de operaciones cuentan dentro del grupo de operación, que puede crear proformas.
- La aplicación **no**: su lista interna de quién puede generar/eliminar/aprobar proformas sólo incluye administrador, administrador de empresa, operador y contador. Al no encontrarlo, la pestaña de Facturación se muestra en sólo lectura y el botón «Generar proforma» no aparece.

Es un desajuste entre la app y la base, no un problema del embarque ni de la cuenta.

## Cambio a realizar

Agregar **Coordinador Logístico** y **Gerente de Operaciones** a la lista de la app que habilita proformas, de modo que quede igual a lo que la base ya permite. Con eso:

- Ven y usan «Generar proforma» en la pestaña de Facturación del embarque que operan.
- Pueden eliminar/reintentar proformas en borrador como los demás roles operativos.
- No cambia nada más: siguen sin poder capturar, aprobar ni pagar facturas de proveedor, sin acceso al módulo de Compras, sin ver finanzas generales, y sin editar costos del embarque (candado B1 intacto).

## Detalle técnico

- `src/lib/access/permissionMatrix.finanzas.ts`: añadir `coordinador_logistico` y `gerente_operaciones` a `PROFORMAS_ESCRITURA`, con comentario de que es espejo de las policies RLS de `proformas` (`has_any_role_efectivo` con `operador`, que ya agrupa ambos roles vía `roles_jerarquia`).
- Sin migración: las policies de `proformas` y `_assert_writer` ya autorizan a estos roles; el cambio es sólo el espejo de UI.
- Ajustar la prueba de invariante `src/lib/access/__tests__/roleRouteMatrix.failClosed.test.ts` (compara la lista exacta) y mantener la aserción de que `vendedor` sigue excluido.
- Revisar `TabFacturacionEmbarque.cerrado.test.tsx` (asume roles operativos en sólo lectura) y actualizar el caso afectado; añadir prueba enfocada de que coordinador y gerente de operaciones obtienen `canEditarProforma = true` y que vendedor/viewer siguen en `false`.
- Validación focal: typecheck, lint de los archivos tocados y sólo esas pruebas Vitest. CI/RLS/E2E completos quedan a GitHub Actions.
- Versionado: bump patch desde 13.823.396 + entrada en `CHANGELOG.md` y manifest si el script lo exige.
