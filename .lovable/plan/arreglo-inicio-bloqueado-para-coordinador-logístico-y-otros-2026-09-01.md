# Arreglo: /inicio bloqueado para coordinador logístico (y otros roles operativos)

## Qué está pasando

El dashboard de inicio pide sus datos a dos funciones del backend (`dashboard_summary` y `dashboard_details`). Desde la ola C9 esas funciones tienen un candado: si el usuario no puede ver "indicadores de dirección" (costos y utilidad), la función **rechaza toda la llamada** con error 42501.

Ese candado sólo deja pasar a: admin, admin_org, super_admin, gerente_comercial, gerente_visor y gerente_operaciones.

Consecuencia verificada en el código: cualquier rol operativo (coordinador_logistico, operador, vendedor, customer_service, agente_carga) recibe el error y ve la pantalla "No pudimos cargar la información" en `/inicio`, aunque su dashboard ni siquiera muestra dinero: la pantalla ya tiene `hideFinancials` y oculta la tabla de utilidad y las columnas de importes.

Analogía: es como cerrar con llave todo el edificio porque hay una caja fuerte adentro. Lo correcto es cerrar la caja fuerte, no el edificio.

## Qué se va a corregir

Cambiar el candado de "bloquear todo" a "entregar el dashboard sin las cifras de dinero":

- Si el usuario sí puede ver indicadores de dirección: respuesta idéntica a hoy (sin cambios).
- Si no puede: la función responde normal, pero **elimina del JSON las llaves de costo, venta, utilidad y margen** (por ejemplo `ventaMXN`, `costoMXN`, `profitMXN`, `margenMXN`, `ventaUSD`, `costoUSD`, `gastosOperativosMXN`, y sus equivalentes por línea en las listas de embarques). Los conteos por estado, arribos, alertas de demora y listados operativos siguen llegando.

Con esto la restricción de C9 (vendedores y operativos no ven costos) se conserva y se refuerza: hoy la protección depende de que la UI oculte; después el dato ni siquiera sale del servidor.

## Alcance

- No se agregan pantallas, roles, tablas ni RPCs nuevos.
- No se toca el cálculo del dashboard (`_dashboard_summary_calc` / `_dashboard_details_calc`), sólo el envoltorio que hoy lanza el error.
- No se modifica la lista de roles con acceso a indicadores de dirección.

## Detalle técnico

1. Migración que reemplaza `public.dashboard_summary()` y `public.dashboard_details()`:
   - Quitar el `RAISE EXCEPTION 'LC_DASHBOARD_SIN_PERMISO...'`.
   - Calcular el JSONB y, cuando `NOT public.puede_ver_dashboard_direccion(auth.uid())` y no sea `service_role`, aplicar una función de saneo que borre las llaves financieras del objeto raíz, de los sub-objetos (`arribosEsteMes`, `resumenMesSiguiente`) y de cada elemento de las listas (`profitArribosEsteMes`, `embarquesMesSiguiente`, `alertasDemora`, `proximosArribos`).
   - Mantener `SECURITY DEFINER`, `search_path = public` y los `GRANT` actuales.
2. Actualizar el espejo en `supabase/schema/` y regenerar `supabase/schema/baseline.sql`.
3. Frontend: sin cambios de lógica. Los parsers ya usan `COALESCE`/valores por defecto cuando falta un campo; se verifica que `hideFinancials` siga ocultando esos bloques para los roles operativos.
4. Pruebas: caso que confirme que un rol operativo recibe respuesta válida sin llaves financieras y que un rol de dirección la recibe completa.
5. Cierre: `bun run db:postcheck` en verde, `CHANGELOG.md` y bump de `APP_VERSION` a 13.820.7.
