# Acceso contable al Catálogo de productos — Solo pestaña Facturación

## Diagnóstico

En `src/routes/appRoutes.tsx:121`, la ruta `/configuracion` está protegida así:

```ts
guarded(["admin", "admin_org", "super_admin"], <Configuracion />)
```

El rol `contador` no está en la lista, así que el guard lo redirige y jamás llega a `Configuración → Facturación → Catálogo de productos`.

## Analogía

Le vamos a dar al contador la llave del cuarto de configuración, pero con una repisa forrada: sólo puede acercarse al estante de Facturación. Los demás estantes (Empresa, Catálogos de puertos, Operaciones, Herramientas) siguen tapados para él.

## Cambios

### 1. `src/routes/appRoutes.tsx`

Agregar `contador` al guard de `/configuracion`:

```ts
<Route path="/configuracion" element={guarded(["admin", "admin_org", "contador", "super_admin"], <Configuracion />)} />
```

### 2. `src/features/admin/routes/admin-org/Configuracion.tsx`

- Importar `useAuth` (o el hook de rol activo que ya use el proyecto — verificaré cuál) para leer el rol efectivo.
- Calcular `esContador = rolEfectivo === "contador"` (y NO tiene además `admin`/`admin_org`/`super_admin`).
- Si `esContador`:
  - Renderizar sólo el `<TabsTrigger value="facturacion">` en la lista de tabs.
  - Renderizar sólo el `<TabsContent value="facturacion">`.
  - Forzar el estado inicial `tab = "facturacion"` (en lugar de `"empresa"`).
  - Ocultar el botón "Guardar Cambios" del header cuando esté en Facturación (esa pestaña no lo necesita — el catálogo tiene su propio flujo de guardado por producto).
- Los admins siguen viendo las 5 pestañas y el botón de guardar como hasta ahora.

### 3. Verificación

- Login como contador → navegar a `/configuracion` → ve solo la pestaña "Facturación" con el catálogo.
- Login como admin_org → ve las 5 pestañas normales.
- Typecheck con `tsc --noEmit`.

### 4. Versión y changelog

- `APP_VERSION` → `13.170.4`.
- Entrada breve en `CHANGELOG.md`.

## Riesgos

Bajo. El único punto de cuidado es asegurar que el guard use el rol efectivo (respetando impersonación de super_admin, si aplica). Ya existen patrones en el proyecto para eso; los reutilizo.

## Fuera de alcance

- No se toca la lógica del sidebar (los enlaces al menú Configuración; si el contador ya lo veía oculto, en un segundo paso ajustamos la visibilidad ahí también — lo confirmo tras revisar el sidebar).
- No se cambian permisos de BD (RLS de `catalogo_claves_sat` ya permite lectura/escritura al contador según la matriz de roles vigente; si al probar aparece error de RLS, se levanta un plan aparte).
