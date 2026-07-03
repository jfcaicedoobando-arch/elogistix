## Objetivo

Arreglar los 3 tests que rompió el último push (los que me compartiste en el ZIP de CI) y confirmar que el enlace **Configuración** ya está visible para el rol contador en el sidebar.

---

## 1. Configuración visible para contador (verificación)

El código del sidebar (`buildContador` en `src/hooks/layout/sidebarRoleBuilders.ts`) ya incluye el item **Configuración** dentro del bloque "Facturación", y la ruta `/configuracion` ya acepta el rol `contador`. Si en el preview no aparece, es cache del navegador: te pediré recargar con **Ctrl/Cmd + Shift + R** después del build. No hay cambios de código aquí.

## 2. Fallback de IVA (test rojo #1)

**Archivo:** `src/features/facturacion/services/conceptosFacturaCrud.ts`

El test que falla envía un renglón con `tasa_iva_aplicada: null` y **sin** `tipo_iva`. Mi fallback lo estaba tratando como "gravado_16" (16%) por defecto y sumaba IVA duplicado.

Corrección: solo aplicar `resolverTasa(tipo_iva)` cuando `tipo_iva` viene definido y no-null. Si ambos son null → 0 (exento).

## 3. Test de rutas espera nuevos allowedRoles (test rojo #2)

**Archivo:** `src/routes/__tests__/appRoutes.smoke.test.tsx` (línea 134)

Actualizar la fila:
```
["/configuracion", ["admin", "admin_org", "contador", "super_admin"]],
```
para reflejar que `contador` ahora es un rol permitido en esa ruta (cambio hecho en v13.170.4).

## 4. `useProductosCatalogo` importa supabase directo (test rojo #3)

**Archivos:**
- Crear `src/features/cotizacion/services/productosCatalogoService.ts` con la función `fetchProductosCatalogo(organizationId)` que hace el `select` a `catalogo_claves_sat`.
- Modificar `src/features/cotizacion/hooks/useProductosCatalogo.ts` para consumir ese servicio y eliminar el import de `@/integrations/supabase/client`.

Solo se mueve la llamada; el shape del resultado y la API pública del hook (`productos`, `porNombre`, `data`, etc.) queda igual.

## 5. Versión + changelog

- `APP_VERSION` → `13.170.7`.
- Entrada en `CHANGELOG.md` describiendo los 3 fixes de CI.

---

## Verificación

- `bunx vitest run src/features/facturacion/services/__tests__/conceptosFacturaCrud.test.ts src/routes/__tests__/appRoutes.smoke.test.tsx src/lib/__tests__/architecture.test.ts` en verde.
- Recargar preview y ver **Facturación → Configuración** en el sidebar del contador.

## Fuera de alcance

- Otros hooks/contexts que importen supabase directo (si los hay); solo se toca el que reporta el test.
- Lógica del catálogo de productos.