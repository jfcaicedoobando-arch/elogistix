# Corregir: Super Admin ve datos de todas las organizaciones

## Qué está pasando (confirmado)

Cuando entras como Super Admin y eliges "Chino Cochino" en el selector de organización, el tablero de inicio no muestra los datos de ese tenant, sino los de **todas** las organizaciones sumadas (por eso parecen "de otra org").

Causa verificada en la base de datos: las funciones de agregación del tablero filtran así:

```text
organization_id = current_user_org_id()  OR  el usuario es super_admin
```

Para un super admin la segunda condición siempre es verdadera, así que la función devuelve los embarques, cobranza y profit de todos los tenants. Además esas funciones **no reciben** ningún parámetro de organización, por lo que el selector del sidebar no tiene forma de influir en el resultado (el resto de los listados sí filtran, porque usan `useOrgFilter`).

Funciones afectadas (16, confirmadas en la base): `dashboard_summary`, `dashboard_details`, `dashboard_stats`, `dashboard_facturacion_kpis`, `direccion_totales`, `operaciones_stats`, `profit_por_embarque`, `profit_por_cliente`, `cobranza_agregados`, `conciliacion_resumen`, `estado_cuenta_agregados`, `estado_cuenta_bancario`, `busqueda_global`, `embarques_alertas_ids`, `operadores_distintos`, `refrescar_garantia_desde_tarifa`.

## Qué se va a construir

1. **Parámetro de organización explícito en las RPC de agregación.** Cada función recibirá `p_org uuid` (opcional, al final para no romper llamadas existentes) y filtrará por `organization_id = p_org` cuando venga. Reglas de resolución dentro de la función:
   - Usuario normal: se ignora `p_org` y se usa siempre su propia organización (nadie puede espiar otro tenant).
   - Super admin con `p_org`: se usa ese tenant.
   - Super admin **sin** `p_org`: no se devuelve nada del tenant (cero filas), en vez del comportamiento actual de "todo junto". Así el modo Plataforma nunca mezcla datos.
2. **El frontend manda la organización activa.** Los hooks del tablero y de los reportes agregados pasarán `organizationId` de `useOrgActiva()` y lo incluirán en la `queryKey`, igual que ya hacen los listados. Con esto, cambiar de tenant en el selector recarga las cifras correctas (el cambio de org ya limpia la caché de React Query).
3. **Estado vacío del modo Plataforma.** Si el super admin no tiene tenant seleccionado, el tablero mostrará un aviso "Selecciona una organización para ver sus indicadores" en lugar de ceros silenciosos.
4. **Pruebas.**
   - SQL de aislamiento: un super admin con `p_org = A` no ve ni un registro de la org B; un usuario de la org B que manda `p_org = A` sigue viendo sólo B.
   - Unitarias de hooks: la `queryKey` cambia con la organización y se envía `p_org`.
5. **CHANGELOG.md** + bump de `APP_VERSION`.

## Detalles técnicos

- Migración SQL que hace `CREATE OR REPLACE` de las 16 funciones, sustituyendo el predicado `(organization_id = current_user_org_id() OR has_role(auth.uid(),'super_admin'))` por un helper nuevo `public.org_scope(p_org uuid)` (`STABLE SECURITY DEFINER`) que devuelve la organización efectiva: la propia para usuarios normales, `p_org` validado para super admin, `NULL` si el super admin no eligió tenant. El predicado queda `organization_id = public.org_scope(p_org)`, que con `NULL` no devuelve filas.
- Se conservan las firmas actuales sin `p_org` sólo donde haya llamadas externas (edge functions/crons); en ese caso se agrega el parámetro con `DEFAULT NULL`.
- No se cambian las políticas RLS de las tablas en esta iteración: el super admin sigue necesitando lectura cross-org para las pantallas de administración (`/admin/...`). El aislamiento por tenant se hace en la capa de agregación + el filtro `organizationId` de los listados.
- Archivos de frontend previstos: `src/features/dashboard/services/index.ts`, `src/features/dashboard/hooks/useDashboardData.ts`, `src/lib/query` (claves del dashboard), y los hooks de dirección/operaciones/cobranza/conciliación que llamen a las RPC listadas.
