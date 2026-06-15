
# Separación de módulos de Auditoría

Hoy existe una sola ruta `/auditoria` que sirve hallazgos operativos por organización. Se va a clarificar la nomenclatura, restringir acceso al rol correcto y dejar reservado el espacio del módulo del dueño de Libre Carga (sin construir su contenido todavía).

## Alcance acordado

- **Solo renombrar y reubicar.** No se construye el módulo del dueño aún.
- **Acceso al operativo:** Admin de la organización y Viewers. Operadores dejan de verlo.
- **Módulo dueño:** placeholder en `/admin/auditoria` visible solo para superadmin de Libre Carga.

## Cambios funcionales

### 1. Auditoría operativa (clientes)
- Ruta sigue siendo `/auditoria` (sin romper bookmarks).
- Título y descripción del `PageHeader` quedan explícitos:
  - Título: **"Auditoría operativa"**
  - Descripción: **"Salud operativa, hallazgos y acciones pendientes detectadas en los embarques de tu organización."**
- Entrada del sidebar renombrada a **"Auditoría operativa"** (etiqueta corta: "Auditoría op.").
- Guard de acceso: limitar a `admin` y `viewer` de la organización. Operadores ya no ven la entrada ni pueden navegar a la ruta (redirect a `/`).

### 2. Auditoría de plataforma (dueño Libre Carga) — placeholder
- Nueva ruta `/admin/auditoria` dentro de `adminRoutes.tsx`, protegida por el guard de superadmin existente.
- Página placeholder con:
  - `PageHeader` "Auditoría de plataforma" + descripción "Salud global de Libre Carga: uso por organización, errores, integridad cross-tenant."
  - `EmptyState` explicando "Módulo en construcción" y lista de KPIs previstos (uso por org, errores recientes, snapshots globales, integridad multi-tenant).
- Entrada en el sidebar admin (sección plataforma) solo visible para superadmin.
- Sin lógica de datos ni RPCs nuevas en esta iteración.

### 3. Memoria del proyecto
- Actualizar `mem://index.md` Core para registrar la separación de nomenclatura.
- Nueva memoria `mem://features/auditoria-modulos` con la distinción (operativa vs plataforma) y ubicación de rutas/roles.

## Detalle técnico

Archivos a tocar (todos ≤200 líneas):

- `src/features/auditoria/routes/AuditoriaPage.tsx` — actualizar título/descripción del `PageHeader`.
- `src/routes/appRoutes.lazy.ts` / `appRoutes.tsx` — agregar guard de rol (`admin` | `viewer`) en `/auditoria`.
- `src/components/layout/*` (sidebar app) — renombrar label, ocultar para `operador`.
- `src/routes/adminRoutes.tsx` — nueva ruta `/admin/auditoria` lazy.
- `src/pages/admin/AdminAuditoriaPlataforma.tsx` (nuevo, <100 líneas) — placeholder con `PageHeader` + `EmptyState`.
- Sidebar admin — nueva entrada visible solo a superadmin.
- `CHANGELOG.md` + `src/constants/appVersion.ts` — bump a `13.21.26`.
- `mem://index.md` + `mem://features/auditoria-modulos`.

No se tocan: RPCs, edge functions, tablas `auditoria_*`, lógica de hallazgos, snapshots, ni la pestaña ejecutiva. Es exclusivamente nomenclatura, routing y permisos.

## Fuera de alcance (siguiente iteración, si decides)

- Contenido real del módulo del dueño (KPIs globales, listado de orgs con hallazgos, errores recientes desde `app_logs`, snapshots cross-org).
- Redirect 301 desde `/auditoria` hacia una URL nueva (se conserva la actual).
