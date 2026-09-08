# Puertos, Navieras y Tipos de Contenedor: encender/apagar por empresa

## Problema

Los tres catálogos son globales (una sola lista compartida por todas las empresas). Hoy el interruptor "Activo" intenta cambiar la lista global, y sólo el dueño de Libre Carga tiene permiso, así que el administrador de empresa recibe "No tienes permisos para activar o desactivar puertos".

Verificado en la base: en `puertos`, `navieras` y `tipos_contenedor` la única regla de escritura exige rol `super_admin`; el usuario del reporte tiene rol `admin_org`.

## Qué se va a construir

Cada empresa tendrá su propia "lista de apagados" sobre el catálogo global:

- El interruptor de la pestaña de catálogos deja de tocar la lista global y pasa a encender/apagar el elemento **sólo para la empresa activa**.
- Los selectores de cotizaciones y embarques dejan de ofrecer lo que la empresa apagó.
- Un elemento apagado globalmente por Libre Carga sigue oculto para todos.
- Agregar y eliminar del catálogo global siguen siendo exclusivos del dueño de Libre Carga; para el resto esos controles se ocultan (como ya ocurre con eliminar), en lugar de fallar tras el clic.
- Un valor ya usado en una cotización o embarque existente se sigue mostrando aunque la empresa lo apague (no se altera nada histórico).

## Detalles técnicos

Base de datos (una migración):

```text
public.catalogo_org_desactivado
  organization_id  uuid    (empresa)
  catalogo         text    ('puertos' | 'navieras' | 'tipos_contenedor')
  item_id          uuid    (elemento del catálogo global)
  created_at / created_by
  PK (organization_id, catalogo, item_id)
```

- `GRANT SELECT, INSERT, DELETE` a `authenticated`, `GRANT ALL` a `service_role`.
- RLS: lectura para miembros de la organización; alta/baja sólo para quien ya puede administrar el tenant (misma función de rol que usa el resto del módulo de configuración), siempre con `organization_id` de la membresía del usuario.
- No se modifican filas de `puertos`, `navieras` ni `tipos_contenedor`.

Frontend:

- `createCatalogHooks`: `fetch` recibe la lista de apagados de la empresa; `useList` (activos) excluye global-inactivos **y** apagados por la empresa; `useListAll` (vista admin) los devuelve todos con una bandera `activoOrg`.
- `setActivo` del hook pasa a insertar/borrar en `catalogo_org_desactivado` (idempotente), en vez de `update` sobre la tabla global. Se conserva el registro en bitácora existente.
- `puertos.ts`, `navieras.ts`, `tiposContenedor.ts`: se agrega el filtro por apagados de la empresa; se conserva la deduplicación canónica de tipos de contenedor.
- `TabPuertos.tsx` y las pestañas equivalentes de navieras y tipos: el interruptor refleja `activoOrg`, con texto que aclara "visible para tu empresa"; el formulario de alta se muestra sólo con permiso global.
- Se elimina el mensaje engañoso de falta de permisos en el interruptor; el de eliminar se conserva.
- Pruebas focalizadas: filtrado por apagados, encender/apagar idempotente, valor histórico preservado y ocultamiento de controles sin permiso.

Validación: typecheck, ESLint y build focalizados. CI, RLS y suites completas quedan para GitHub Actions. Se sube versión y se registra en `CHANGELOG.md`.
