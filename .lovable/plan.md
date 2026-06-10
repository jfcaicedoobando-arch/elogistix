## Objetivo

El usuario `demo@librecarga.com` entra hoy como `operador`, lo que oculta módulos de administración, configuración, finanzas y reportes. Para que un prospecto explore *todas* las bondades del producto, lo elevamos a `admin` de la organización demo. Como los datos se re-siembran en cada acceso, no hay riesgo de daño persistente.

## Cambios

1. **DB — `ensure_demo_membership(_user_id)`**
   - `user_roles`: forzar `role = 'admin'` (en lugar de `'operador'`) usando `ON CONFLICT (user_id) DO UPDATE`.
   - `organization_members`: forzar `role = 'admin'` en la org demo (`de100000-…-0001`).

2. **Edge function `demo-access`**
   - Sin cambios de lógica (sigue llamando `ensure_demo_membership` y `seed_demo_organization`), pero conviene re-desplegarla para que las sesiones existentes vuelvan a pasar por el flujo.

3. **Banner demo (`DemoModeBanner`)**
   - Añadir nota corta: *"Estás como administrador de una organización demo. Los cambios se borran en cada acceso."* para dejar claro el alcance.

4. **Documentación**
   - `CHANGELOG.md` + bump `APP_VERSION` (12.76.1).
   - Actualizar memoria `mem://features/demo-trial-access` para reflejar rol `admin`.

## Qué NO cambia

- Sigue siendo una sola cuenta demo compartida.
- El seed sigue limpiando/repoblando la org demo en cada login.
- No tocamos RLS ni roles de usuarios reales.
- No agregamos super_admin (eso daría acceso global a otras orgs, lo cual sería peligroso).

## Riesgos

- Un usuario demo podría intentar invitar a otros usuarios desde Usuarios; queda mitigado porque los registros se borran en cada re-siembra (cualquier alta queda fuera del flujo de seed y la próxima sesión la elimina si la añadimos a la rutina). Si quieres, en una iteración posterior puedo extender el seed para borrar también membresías extra creadas durante la sesión.
