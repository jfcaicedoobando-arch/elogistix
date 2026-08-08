# Por qué el super-admin aterriza en "Chino Cochino"

## Diagnóstico (verificado en base y código)

- `hlopezb@gmail.com` (`38f502b3…`) tiene rol global `super_admin`, pero **no tiene ninguna fila en `organization_members`** — no pertenece a ninguna organización.
- El contexto de organización (`src/lib/contexts/OrganizationContext.tsx`) elige la org activa del super-admin así:
  1. preferencia guardada en el navegador,
  2. su **propia** organización (la de su membresía),
  3. si no hay ninguna de las dos: **`orgList[0]`**, o sea la primera de la lista ordenada por nombre.
- Organizaciones activas hoy: **Chino Cochino** y **Elogistix** (las dos demo están inactivas). Alfabéticamente, "Chino Cochino" es la primera.

Resultado: al no tener membresía ni preferencia previa, cae en el paso 3 y entra a Chino Cochino. No es un problema de permisos ni de fuga de datos: es el fallback.

Analogía: es como un gerente regional con llave maestra que, al no tener oficina asignada, el elevador lo deja en el primer piso de la lista.

## Cambios propuestos

1. **Fallback a la organización de casa (Elogistix)**: cuando un super-admin no tiene membresía ni preferencia guardada, aterrizar en la organización del sistema (`00000000-0000-0000-0000-000000000001`, Elogistix) en lugar de la primera alfabética. Si esa org no existiera o estuviera inactiva, se conserva el comportamiento actual como último recurso.
2. **Membresía del super-admin en Elogistix**: agregar la fila faltante en `organization_members` para `hlopezb@gmail.com` con rol admin de Elogistix, de modo que el paso 2 (org propia) funcione y su contexto sea explícito, no derivado de un fallback.
3. **Aviso visible de tenant activo**: en el selector de organización del sidebar, marcar cuando el tenant activo **no** es la organización propia del super-admin (etiqueta tipo "Viendo otro tenant"), para que nunca haya duda de en qué org se está trabajando.

## Detalles técnicos

- `src/lib/contexts/OrganizationContext.tsx`: cambiar el fallback `propia ?? orgList[0]` por `propia ?? orgSistema ?? orgList[0]`, con la constante de org del sistema tomada de donde ya se define (evitar hardcode nuevo: hay un test `no-hardcoded-org-default` que vigila esto, así que la constante debe vivir en un módulo de constantes).
- Migración: `INSERT` idempotente en `public.organization_members` (org Elogistix, rol admin) para ese `user_id`.
- Sidebar: ajuste de presentación en el selector de organización (`OrgSwitcher`/indicadores de contexto ya existentes).
- Tests: extender `src/lib/contexts/__tests__/OrganizationContext.test.tsx` con el caso "super-admin sin membresía → org del sistema".
- `CHANGELOG.md` + `APP_VERSION`.
