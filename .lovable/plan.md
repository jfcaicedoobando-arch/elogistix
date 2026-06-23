## Cambio

Ampliar la política RLS **`Tenant CRUD proveedor_facturas`** para incluir a **`auxiliar_contable`** y **`tesorero`** además de los roles actuales (`admin`, `super_admin`, `contador`).

Hoy, si un tesorero o auxiliar contable abre el modal "Nueva factura de proveedor" e intenta guardar, Postgres rechaza con `new row violates row-level security policy` aunque la UI les permita capturar.

## Migración SQL

```sql
DROP POLICY "Tenant CRUD proveedor_facturas" ON public.proveedor_facturas;

CREATE POLICY "Tenant CRUD proveedor_facturas"
ON public.proveedor_facturas
FOR ALL
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'))
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'contador')
    OR has_role(auth.uid(), 'auxiliar_contable')
    OR has_role(auth.uid(), 'tesorero')
  )
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'))
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'contador')
    OR has_role(auth.uid(), 'auxiliar_contable')
    OR has_role(auth.uid(), 'tesorero')
  )
);
```

## Tablas relacionadas a revisar/alinear

Para que el flujo completo de capturar factura funcione end-to-end para los nuevos roles, también necesitan poder escribir en las tablas hijas:

- `proveedor_facturas_conceptos` — revisar y ampliar si tiene la misma lista de roles.
- `pagos_proveedor` — opcional (tesorero ya suele tener acceso; auxiliar quizá no debería). **Sugerencia: dejar `pagos_proveedor` como está y sólo tocar las dos tablas de captura.**

Voy a revisar `proveedor_facturas_conceptos` en la misma migración y, si su política excluye a estos roles, la amplío con el mismo patrón.

## Verificación

- Suites RLS: `test_rls_financiero_critico.sql` y `test_rls_tarifas_y_costeo.sql` ya siembran categorías y un usuario `contador` — agregar dos asserts: tesorero y auxiliar_contable pueden insertar `proveedor_facturas`, viewer/vendedor siguen bloqueados.
- `APP_VERSION` → `13.114.10`
- Entrada en `CHANGELOG.md`.

## Analogía

Hoy la caja fuerte de "facturas de proveedor" tiene tres llaves (admin, contador, super_admin). Vamos a copiar dos llaves más para el tesorero y el auxiliar contable — la chapa sigue siendo la misma, sólo hay más gente autorizada a abrirla.
