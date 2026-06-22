## Hallazgos de la auditoría de permisos para admins

Revisé las tres capas donde se evalúan permisos: `usePermissions.ts` (UI), `roleHierarchy.ts` (guardas de rutas frontend) y la función `public.has_role()` + políticas RLS en la base de datos.

### Resultado: admin_org y super_admin SÍ tienen todos los permisos habilitados

**Frontend (`usePermissions.ts`)** — Las 6 capacidades operativas y las 4 del Bloque Q (emitir factura, capturar factura proveedor, pagar proveedor, registrar cobro) incluyen explícitamente `super_admin`, `admin_org` y `admin` en cada lista. ✓

**Guardas de ruta (`roleHierarchy.ts`)** — `admin_org` satisface `admin`, `operador`, `viewer`, `vendedor`, `contador`, `tesorero`, `auxiliar_contable` y `ejecutivo_cobranza`. `super_admin` satisface todo lo anterior. ✓

**Base de datos (RLS)** — Revisé las políticas que usan `has_role('contador'|'operador'|'vendedor'|...)`: todas ellas también incluyen `has_role('admin')` u `has_role('admin_org')` en el mismo OR, y la función `has_role` agrupa `admin` → `[admin, admin_org, super_admin]`. Por lo tanto admin_org y super_admin pasan todas las políticas RLS revisadas. ✓

### Inconsistencias menores detectadas (no bloquean a admin, pero conviene anotarlas)

La función `public.has_role()` en BD **no está sincronizada** con `roleHierarchy.ts` del frontend para los roles nuevos del Bloque Q:

1. **Grupo `viewer` en BD** no incluye `auxiliar_contable` ni `ejecutivo_cobranza` (el frontend sí).
2. **No hay agrupaciones en BD** para `contador`, `tesorero`, `auxiliar_contable`, `ejecutivo_cobranza` (caen al ELSE = sólo coincidencia exacta). El frontend asume que `admin_org`/`super_admin` los satisfacen.
3. Esto **no afecta a admin_org hoy** porque cada política RLS también acepta `has_role('admin')`. Pero si en el futuro alguien escribe una política que sólo pida, por ejemplo, `has_role('tesorero')` sin incluir admin, admin_org no pasaría a nivel BD aunque el frontend le muestre el botón.

### Qué propongo hacer

**Opción A — Sólo confirmar (no tocar nada).** Admin tiene todos los permisos hoy; cierro la revisión con esta nota.

**Opción B — Sincronizar el agrupador de BD con el frontend** (1 migración corta). Actualizar `public.has_role()` para:
- Agregar `auxiliar_contable` y `ejecutivo_cobranza` al grupo `viewer`.
- Agregar grupos para `contador`, `tesorero`, `auxiliar_contable`, `ejecutivo_cobranza` que incluyan `admin_org` y `super_admin` (espejo de `roleHierarchy.ts`).
- Sin cambios en políticas RLS ni en UI.
- Actualizar `CHANGELOG.md` + `APP_VERSION`.

Esto previene el "agujero futuro" descrito en el punto 3 y deja una única fuente de verdad lógica entre front y BD.

¿Quieres que aplique la **Opción B** o prefieres dejarlo como está (Opción A)?