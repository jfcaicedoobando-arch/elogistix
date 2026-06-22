## Objetivo
Reorganizar el sidebar de los roles **admin**, **admin_org** y **super_admin** para que también sigan el patrón tipo Odoo (Compras / Facturación / Tesorería), igual que contador y tesorero.

## Acomodo propuesto para admins

1. **Dashboards**
2. **Gestión operativa** — Cotizaciones, Embarques
3. **Costeo**
4. **Compras** — Bandeja CxP por capturar, Bandeja CxP por pagar, CxP, Proveedores
5. **Facturación** — Bandeja por emitir, Facturación, Proformas, Cartera, Comisiones
6. **Tesorería**
7. **Profit**
8. **CRM**
9. **Reportes**
10. **Directorio** — Clientes
11. **Sistema** — Configuración, Ayuda, Auditoría, Bitácora
12. **Administración** (solo admin / admin_org / super_admin)
13. **Super Admin** (solo super_admin)

## Cambios técnicos

Archivo: `src/hooks/layout/useAppSidebarSections.ts`

- Crear `buildAdmin: Builder` que devuelve las 11 secciones base de arriba.
- Registrar en `ROLE_BUILDERS`: `admin: buildAdmin`, `admin_org: buildAdmin`.
- Para `super_admin` (que no pasa por `ROLE_BUILDERS` porque no tiene `effectiveRole` propio), ajustar la rama final de `useAppSidebarSections`:
  - Si `isAdmin`, usar `buildAdmin(deps)` en lugar de `buildDefaultSections(deps)`.
  - Mantener el push de `Administración` y `Super Admin` al final.
- `buildDefaultSections` se conserva como fallback para roles no mapeados.

Archivo: `src/hooks/layout/__tests__/useLayout.test.tsx` (si existe el caso): actualizar el orden esperado para admin.

## Versionado

- `src/constants/appVersion.ts` → `13.98.1`
- `CHANGELOG.md` → entrada `[13.98.1] - 22/06/2026`: "Sidebar de admin/admin_org/super_admin reorganizado con secciones Compras, Facturación y Tesorería tipo Odoo."

## Verificación

- `bunx vitest run src/hooks/layout`
- Revisar visualmente en `/inicio` que aparezcan las nuevas secciones.
