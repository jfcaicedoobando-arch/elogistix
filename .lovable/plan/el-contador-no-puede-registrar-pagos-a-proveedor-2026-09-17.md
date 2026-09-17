# El contador no puede registrar pagos a proveedor

## Qué pasó

Karol (rol **contador**) intentó registrar el pago de la factura de proveedor DEBIT260830312 (26,263.00 USD) y recibió:

> No se pudo registrar el pago: la cuenta bancaria no existe o está dada de baja

Revisé las cuentas de Elogistix: las cinco existen, están activas y ninguna está eliminada (BBVA MXN, BBVA MXN 88, BBVA USD, BASE MXN, BASE USD). El mensaje es engañoso: la cuenta sí existe.

## Causa confirmada

Al registrar el pago, el sistema "aparta" (bloquea) el renglón de la cuenta bancaria para que nadie la dé de baja a mitad de la operación. Ese apartado se hace con los permisos del propio usuario, y las reglas de acceso de la tabla de cuentas le dan al contador **sólo lectura**: apartar el renglón cuenta como intención de modificarlo, así que la base "no le muestra" la cuenta en ese momento y el proceso concluye que no existe.

Analogía: el contador puede leer la ficha de la cuenta en el archivero, pero no puede sacar la carpeta del archivero. El proceso de pago necesita sacarla un instante, no la puede sacar, y reporta "no encontré la carpeta".

Por eso el contador ve la cuenta en el selector del formulario (lectura permitida) y aun así el pago falla.

El mismo patrón afecta al **traspaso entre cuentas propias**: ahí el apartado se hace sin verificar el resultado, así que para el contador simplemente no aparta nada y la protección contra dos traspasos simultáneos queda sin efecto (no da error, pero tampoco protege).

Roles admin, admin_org y tesorero no se ven afectados; ellos sí pueden apartar el renglón.

## Qué voy a cambiar

1. Un ayudante interno de base de datos que aparte y lea la cuenta bancaria con permisos del sistema, devolviendo su organización, moneda y si está activa. No abre ningún dato nuevo al usuario: sigue siendo el proceso de pago quien compara que la cuenta sea de la misma empresa de la factura y que esté activa, con los mismos mensajes de error.
2. El registro de pago a proveedor usa ese ayudante en lugar de apartar la cuenta directamente. Los tres candados actuales se conservan: cuenta inexistente, cuenta de otra empresa, cuenta inactiva.
3. El traspaso entre cuentas propias usa el mismo ayudante para apartar las dos cuentas, de modo que la protección contra traspasos simultáneos vuelva a funcionar para contador y no sólo para tesorero.
4. No se cambia ninguna regla de acceso: el contador sigue **sin** poder editar ni dar de baja cuentas bancarias.

## Detalles técnicos

- Causa raíz: `public.registrar_pago_proveedor_atomico` es `SECURITY INVOKER` y hace `SELECT ... FROM public.cuentas_bancarias ... FOR UPDATE`. En `cuentas_bancarias` la política `Scope tenant activo super admin` es RESTRICTIVE (ALL) y las únicas políticas permisivas que aplican al comando UPDATE son `Tenant CRUD cuentas_bancarias` (admin / admin_org / super_admin) y `Tesoreria manage cuentas_bancarias` (tesorero). `Tesoreria read cuentas_bancarias` es sólo SELECT, así que para `contador` el `FOR UPDATE` no devuelve fila → `v_cta_org IS NULL` → `LC_PAGO_CUENTA_INEXISTENTE` (P0001).
- `es_escritor_financiero` incluye `contador`, y las políticas de `pagos_proveedor` y `bbva_movimientos` permiten a contador insertar: el rol sí debe poder registrar pagos.
- Migración: nueva función `public._lock_cuenta_bancaria(p_cuenta_id uuid) RETURNS TABLE(organization_id uuid, moneda text, activa boolean)`, `SECURITY DEFINER`, `SET search_path = public`, `STRICT`-safe, con `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE TO authenticated, service_role` (requisito H6). Filtra `deleted_at IS NULL` y hace `FOR UPDATE`.
- `registrar_pago_proveedor_atomico`: sustituye el `SELECT ... FOR UPDATE` por el ayudante, conservando la validación de organización, actividad y los códigos `LC_PAGO_CUENTA_INEXISTENTE`, `LC_PAGO_CUENTA_OTRA_ORG`, `LC_PAGO_CUENTA_INACTIVA`.
- `registrar_traspaso_bancario`: sustituye el `PERFORM ... FOR UPDATE` por dos llamadas al ayudante en orden ascendente de id (se conserva el orden determinista anti-deadlock).
- Espejos canónicos actualizados en el mismo cambio: `supabase/schema/cxp/registrar_pago_proveedor_atomico.sql`, `supabase/schema/tesoreria/registrar_traspaso_bancario.sql`, nuevo `supabase/schema/tesoreria/_lock_cuenta_bancaria.sql`, más `supabase/schema/baseline.sql` y `migration-manifest.json`.
- Cobertura: prueba RLS nueva en `supabase/tests/` que registra un pago como `contador` (debe pasar) y verifica que sigue fallando con cuenta inactiva, de otra organización o inexistente. No se ejecuta en Lovable; corre en GitHub Actions.
- Sin cambios de frontend, sin publicar y sin bump de versión/changelog en este cambio (el changelog se registrará al cerrar, según la convención del proyecto).
