## Objetivo

Que el agente, al entrar al Portal del Agente, vea claramente **dos identidades** en el header: su **nombre de agente** (ya existe) y el **nombre de la organización** (cliente/forwarder) a la que pertenece — que hoy no aparece en ningún lado.

## Dónde se muestra hoy

`AgenteLayout` (header sticky superior) ya pinta:

```
[Logo Libre Carga]  Portal Agente · {agenteNombre}
```

Falta el nombre de la organización. La idea es que el agente sepa "estoy viendo cosas de la organización X" sin tener que adivinar.

## Cambios propuestos

1. **Backend (lectura)** — Extender `fetchAgenteContext()` en `src/features/portal-agente/services/index.ts`:
   - Agregar el join `organizations:organization_id(nombre)` al SELECT sobre `agente_users`.
   - Devolver un nuevo campo `organizacionNombre: string` en la interfaz `AgenteContext`.
   - Si las políticas RLS actuales de `organizations` no permiten al rol `agente` leer la fila, crear una función `SECURITY DEFINER` `get_agente_org_nombre()` que devuelva sólo el `nombre` (sin filtrar datos sensibles) y llamarla con `supabase.rpc(...)`. Decidimos al ejecutar, según el error que dé el join.

2. **UI (header)** — En `src/features/portal-agente/components/AgenteLayout.tsx`:
   - Mantener el subtítulo del `BrandLockup` como `Portal Agente · {agenteNombre}`.
   - Agregar al lado del email (extremo derecho del header) un chip pequeño con el ícono `Building2` y el texto `{organizacionNombre}`, oculto en pantallas chicas (`hidden sm:inline-flex`).
   - En el header móvil (la nav inferior `md:hidden`), agregar una línea superior delgada con el mismo nombre de organización para que también se vea en celular.

3. **Tooltip** — Añadir `title={organizacionNombre}` al chip para que al pasar el mouse se vea completo cuando se trunque.

## Lo que NO cambia

- Sin tocar permisos, RLS de embarques/tarifas, ni rutas.
- Sin cambios en `costeo_agentes` ni en `agente_users`.
- Sin tocar el flujo de invitación ni la edge function `user-management`.

## Validación

- Iniciar sesión como agente de prueba (ej. Chino el agente) y verificar:
  - Header muestra "Portal Agente · Chino el agente" + chip con nombre de la organización a la derecha.
  - En móvil, el nombre de la org aparece en la barra superior.
- Que no rompa los tests existentes del portal (`useAgenteContext` mantiene compatibilidad agregando un campo, no quitando).

## Changelog

Bump `APP_VERSION` y entrada en `CHANGELOG.md` describiendo: "Portal del Agente — header ahora muestra el nombre de la organización junto al nombre del agente y el email."