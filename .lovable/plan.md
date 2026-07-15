
## Problema

Al hacer clic en **Sustituir CFDI** (usuaria Karol, rol `contador`), la base de datos revienta con:

> `invalid input value for enum app_role: "contabilidad"`

**Causa raíz:** la función `public.duplicar_factura_para_sustitucion(uuid)` (migración `20260630172919`, líneas 401–408) valida el rol así:

```sql
AND role IN ('admin_org','admin','super_admin','contabilidad')
```

Pero el enum real `public.app_role` **no contiene `contabilidad`**. Los roles contables válidos son `contador`, `auxiliar_contable`, `tesorero` (más `admin_org`, `admin`, `super_admin`). Postgres castea la lista a `app_role`, no encuentra `'contabilidad'`, y aborta antes siquiera de evaluar la condición. Resultado: **nadie** puede duplicar la factura para sustituir CFDI — no sólo contadores.

Analogía: es como si el portero revisara tu credencial contra una lista donde uno de los "roles autorizados" está mal escrito y no existe en el sistema. Al no poder leer la lista completa, el portero se cae y nadie pasa.

La misma cadena aparece también en la versión anterior de la función (`20260626055826`, líneas 48–50), pero esa fue reemplazada por la de 20260630 — con arreglar la vigente basta.

## Plan

1. **Nueva migración** que hace `CREATE OR REPLACE FUNCTION public.duplicar_factura_para_sustitucion(p_factura_id uuid)` idéntica a la actual pero con:
   - `role IN ('admin_org','admin','super_admin','contador','auxiliar_contable','tesorero')`
   - Mensaje de excepción: `'forbidden: requiere rol admin, contador o tesorero'`
   - Mantiene `SECURITY DEFINER`, `search_path`, y el `GRANT EXECUTE ... TO authenticated` existente.

2. **Test de regresión** en `src/features/facturacion/services/__tests__/facturapi.test.ts` (o similar) que verifique que el RPC se invoca correctamente. Este ya existe; no necesita cambios de lógica, pero sí un caso adicional que documente que roles contables pueden sustituir.

3. **CHANGELOG.md** + bump `APP_VERSION` a `13.300.50`.

4. **Verificación**: llamar el RPC contra la BD con un usuario `contador` (via `read_query` no aplica porque muta; se probará implícitamente al reintentar desde la UI). Confirmar en el linter que no queden referencias a `'contabilidad'` en migraciones activas.

## Detalles técnicos

- Roles a permitir (basado en enum real y catálogo de roles): `admin_org`, `admin`, `super_admin`, `contador`, `auxiliar_contable`, `tesorero`.
- **No** se altera el enum `app_role` (no hay que agregar `'contabilidad'` porque nadie lo usa en tablas ni en el resto de la app; sólo era un typo del gatekeeper).
- Sin cambios en frontend ni en el hook `duplicarFacturaParaSustitucion`.

## Riesgo

Mínimo. La función se reemplaza en su totalidad, mismo cuerpo salvo la lista de roles y el mensaje. Nada más consume esa cadena `'contabilidad'`.
