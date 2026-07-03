## Problema

Al guardar la API key de FacturApi en `/configuracion`, la usuaria `isela.martinez@elogistixshipping.com` (rol efectivo **contador** en Elogistix) recibe:

```
No se pudo guardar la API key — forbidden (42501)
```

## Causa raíz

El RPC `set_facturapi_api_key` (y sus hermanos `clear_facturapi_api_key`, `get_facturapi_api_key`) llama a `public._assert_facturapi_admin(p_org_id)`, que solo permite:

- `super_admin` (rol global), **o**
- membresía en `organization_members` con `role IN ('admin_org','admin')`.

Cualquier otro rol —incluido **contador**— recibe `RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'`. En el resto del sistema, la facturación electrónica está gobernada por el rol **contador** (RLS de `facturas`, `pagos_factura`, `conceptos_factura`, etc.), así que restringir esto a admin es incoherente y bloquea al usuario natural del módulo.

**Analogía:** es como si la llave de la caja de facturas la tuviera solo el dueño de la empresa, cuando quien la usa todos los días es la contadora.

## Cambio propuesto

Ampliar `_assert_facturapi_admin` para aceptar también el rol `contador` (global, vía `has_role`). Mantener `super_admin`, `admin_org` y `admin` como antes. `tesorero` queda fuera intencionalmente: su alcance en el resto del sistema es *pagos* (cobranza / conciliación bancaria), no configuración de emisor.

### Migración SQL

```sql
CREATE OR REPLACE FUNCTION public._assert_facturapi_admin(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '28000';
  END IF;

  -- super_admin o contador (roles globales) siempre pueden
  IF public.has_role(v_uid, 'super_admin'::public.app_role)
     OR public.has_role(v_uid, 'contador'::public.app_role) THEN
    RETURN;
  END IF;

  -- admin_org / admin dentro de la org también
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
     WHERE om.user_id = v_uid
       AND om.organization_id = p_org_id
       AND om.role IN ('admin_org','admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;
```

No se tocan las 3 RPCs (`set_/clear_/get_facturapi_api_key`) ni los grants: siguen exponiendo `EXECUTE` a `authenticated` y delegando la autorización a este helper. Tampoco cambia RLS de `facturapi_credenciales`.

## Frontend / UX

Ninguno. El mismo formulario `FacturapiCredencialesForm` ahora funcionará para contadores. El toast de error genérico ya quedó arreglado en v13.170.13 (leyendo `context.json()` de `FunctionsHttpError`), así que si en el futuro alguien sin permiso lo intenta verá `forbidden` legible.

## Detalles técnicos

- Archivo nuevo: `supabase/migrations/<timestamp>_facturapi_admin_include_contador.sql` (solo el `CREATE OR REPLACE FUNCTION` de arriba).
- `CHANGELOG.md`: entrada `[13.170.15] - 2026-07-04` describiendo el fix y referenciando el Sentry `useSetFacturapiApiKey`.
- `src/constants/appVersion.ts` → `13.170.15`.
- Sin cambios en TS ni tests (la RPC ya está mockeada como `never` en el service; los tests de `facturapiCredenciales` no dependen del asertor).

## Fuera de alcance

- No se agregan más roles (tesorero, gerente_operaciones): si el usuario lo pide después, se hace en otra iteración.
- No se refactoriza el sistema de permisos general.
- No se cambian las otras RPCs de facturación que ya permiten `contador` por RLS.
