# Parche 25 — Decisiones de producto (VT-10, VF-21, VF-20)

Aplicar el parche 25 con tres decisiones de producto ya definidas.

## Qué cambia

1. **Centro de ayuda público (VT-10)**
   `/ayuda` deja de exigir sesión: se mueve a rutas públicas con una cabecera
   mínima (logo + "Iniciar sesión"), igual que las páginas legales. El contenido
   del FAQ no cambia.

2. **CRM: forecast redirige a analítica (VF-21)**
   `/crm/forecast` ahora redirige a `/crm/analitica` (vista única canónica), sin
   el query legacy `?tab=forecast`.

3. **Vendedor con acceso de sólo lectura a Proformas (VF-20)**
   El rol `vendedor` podrá entrar a `/proformas` y al detalle para dar
   seguimiento comercial, pero **no** podrá enviar al cliente, convertir ni
   registrar respuesta manual. La restricción se aplica en dos capas: base de
   datos (permisos de lectura) y ocultamiento de botones en la interfaz.

## Detalles técnicos

- `src/routes/appRoutes.tsx`: se retira `/ayuda`; los guards de `/proformas` y
  `/proformas/:id` usan el nuevo `PROFORMAS_READ_ROLES`.
- `src/routes/publicRoutes.tsx`: `/ayuda` como ruta pública con `AyudaPublicShell`.
- `src/routes/crmRoutes.tsx`: redirect `/crm/forecast` → `/crm/analitica`.
- `src/lib/access/roleRouteMatrix.ts`: `PROFORMAS_READ_ROLES = FACTURACION_ROLES + vendedor`.
- `src/lib/access/permissionMatrix.finanzas.ts` + `permissionMatrix.ts`: nuevo
  `PROFORMAS_ESCRITURA` (espejo de las policies de escritura; excluye `vendedor`).
- `src/hooks/shared/usePermissions.ts`: nuevo `canEditarProforma`.
- `AccionesProforma.tsx` / `accionesProformaItems.ts`: "Enviar al cliente" sólo
  para roles con escritura.
- Migración `20260825001200_vf20_proformas_lectura_vendedor.sql`: redefine la
  policy de lectura de `proformas` para incluir `vendedor`; write/update/delete
  intactas.
- Tests actualizados: `appRoutes.smoke`, `routes.smoke`, `roleRouteMatrix.failClosed`.

## Verificación

- Aplicar el parche archivo por archivo (el patch trae contexto de la cadena 1–24).
- Correr la migración vía el flujo de migraciones (requiere tu aprobación).
- `tsgo`, tests dirigidos de rutas/permisos/proformas y la suite completa.
- Actualizar `CHANGELOG.md` + `APP_VERSION` a **13.645.0**.
