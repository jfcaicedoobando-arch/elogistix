

## Plan: Fases 3 y 4 completas

### Fase 3.1 — Permisos por rol en la UI

**Objetivo:** Ocultar botones de crear/editar/eliminar para usuarios `viewer`.

**Cambios:**
1. Crear hook `src/hooks/usePermissions.ts` que exponga `canEdit` (true si rol es `admin` u `operador`) basándose en `useAuth().role`
2. Aplicar `canEdit` para ocultar/deshabilitar condicionalmente:
   - `Clientes.tsx`: botón "Nuevo Cliente"
   - `Proveedores.tsx`: botón "Nuevo Proveedor"
   - `Embarques.tsx`: botón "Nuevo Embarque"
   - `Facturacion.tsx`: botón "Marcar Pagado"
   - `EmbarqueDetalle.tsx`: botones "Editar", "Subir archivo", "Generar Factura"
   - `ClienteDetalle.tsx` / `ProveedorDetalle.tsx`: botones de editar
   - `Usuarios.tsx` ya está protegida por ruta admin

---

### Fase 3.2 — Emails de usuarios en tabla de gestión

**Objetivo:** Mostrar el email real del usuario en la tabla de Usuarios en lugar del UUID.

**Cambios:**
1. Crear Edge Function `supabase/functions/list-users/index.ts` que use `adminClient.auth.admin.listUsers()` y devuelva `[{ id, email, created_at }]`, protegida con verificación de rol admin
2. Actualizar `supabase/config.toml` con `[functions.list-users]` y `verify_jwt = false`
3. Modificar `Usuarios.tsx` para invocar `list-users` y cruzar los emails con `user_roles`, mostrando email + fecha de creación

---

### Fase 3.3 — Subida real de documentos (Storage)

**Objetivo:** Los botones "Subir archivo" y "Adjuntar" suben archivos reales al storage.

**Cambios:**
1. Migración SQL: crear bucket `documentos` (público: false) con políticas RLS para admin/operador (upload, select, delete) y viewer (select)
2. Modificar `EmbarqueDetalle.tsx` tab Documentos: el botón "Subir archivo" sube al bucket `documentos/{embarque_id}/{doc_id}/{filename}`, actualiza columna `archivo` en `documentos_embarque`, y muestra link de descarga
3. Modificar `Clientes.tsx` paso 2: los archivos adjuntados se suben al bucket `documentos/clientes/{cliente_id}/{nombre_doc}` al momento de crear el cliente
4. Crear helper `src/lib/storage.ts` con funciones `uploadFile()` y `getFileUrl()`

---

### Fase 3.4 — Búsqueda global

**Objetivo:** Barra de búsqueda en el sidebar/header que busque en embarques, clientes, proveedores y facturas.

**Cambios:**
1. Crear componente `src/components/GlobalSearch.tsx` usando `CommandDialog` (cmdk ya instalado) con atajos de teclado (Ctrl+K)
2. Al escribir, busca en paralelo en las 4 tablas (ilike en nombre/expediente/numero/rfc) con límite de 5 por tipo
3. Al seleccionar resultado, navega a la ruta correspondiente
4. Integrar en `Layout.tsx` o `AppSidebar.tsx`

---

### Fase 4.1 — Loading states y manejo de errores

**Objetivo:** Skeletons consistentes y estados de error amigables.

**Cambios:**
1. Crear componente `src/components/TableSkeleton.tsx` reutilizable (recibe columnas y filas)
2. Crear componente `src/components/ErrorState.tsx` con mensaje y botón de reintentar
3. Aplicar en todas las páginas que usan `isLoading` e `isError` de React Query: Dashboard, Embarques, Facturación, Clientes, Proveedores, Reportes

---

### Fase 4.2 — Responsive (tablas en mobile)

**Objetivo:** Tablas legibles en pantallas pequeñas.

**Cambios:**
1. En mobile, las tablas de listado (Embarques, Clientes, Proveedores, Facturas) se renderizan como tarjetas apiladas en lugar de tabla usando `useIsMobile()`
2. Crear componente `src/components/ResponsiveTable.tsx` que alterne entre vista tabla y vista cards
3. Aplicar en las 4 páginas de listado principales

---

### Fase 4.3 — Tipos de cambio dinámicos

**Objetivo:** Obtener tipo de cambio USD/MXN y EUR/MXN actualizado.

**Cambios:**
1. Crear Edge Function `supabase/functions/exchange-rates/index.ts` que consulte una API gratuita (frankfurter.app) y devuelva tasas USD→MXN y EUR→MXN
2. Configurar `[functions.exchange-rates]` en config.toml
3. Crear hook `src/hooks/useExchangeRates.ts` que invoque la función y cachee por 1 hora
4. Usar las tasas como valores default en `NuevoEmbarque.tsx` (paso 4: tipos de cambio)

---

### Changelog

Actualizar `src/pages/Changelog.tsx` con versión **v3.0.0** consolidando todas las mejoras de Fase 3 y 4.

Actualizar versión en `AppSidebar.tsx` footer de `v1.4.0` a `v3.0.0`.

---

### Resumen de archivos a crear/modificar

**Nuevos:**
- `src/hooks/usePermissions.ts`
- `supabase/functions/list-users/index.ts`
- `src/lib/storage.ts`
- `src/components/GlobalSearch.tsx`
- `src/components/TableSkeleton.tsx`
- `src/components/ErrorState.tsx`
- `src/components/ResponsiveTable.tsx`
- `supabase/functions/exchange-rates/index.ts`
- `src/hooks/useExchangeRates.ts`

**Modificados:**
- `supabase/config.toml` (2 funciones nuevas)
- `Clientes.tsx`, `Proveedores.tsx`, `Embarques.tsx`, `Facturacion.tsx`, `EmbarqueDetalle.tsx`, `ClienteDetalle.tsx`, `ProveedorDetalle.tsx` (permisos + responsive + error states)
- `Usuarios.tsx` (emails reales)
- `NuevoEmbarque.tsx` (tipos de cambio dinámicos)
- `Layout.tsx` o `AppSidebar.tsx` (búsqueda global)
- `Changelog.tsx`, `AppSidebar.tsx` (versión)

**Migración SQL:**
- Crear bucket `documentos` con políticas RLS

