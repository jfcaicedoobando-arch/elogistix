
## Objetivo

Reorganizar el drawer **Compras** del sidebar para todos los roles financieros (admin, admin_org, super_admin, contador, tesorero, auxiliar_contable) siguiendo el estilo de Odoo, dejando un flujo claro: **bandejas operativas primero → registro maestro → catálogo de proveedores**.

## Problema actual

Hoy los 3 ítems aparecen juntos pero con nombres confusos:

- `CxP — Por capturar` (bandeja: embarques sin factura capturada)
- `CxP — Por pagar` (bandeja: facturas con saldo por liquidar)
- `Cuentas por Pagar` (módulo maestro CRUD)

El usuario no distingue cuál es bandeja operativa y cuál es el registro contable completo.

## Cambios propuestos

### 1. Renombrar los 3 ítems en `src/components/layout/sidebarItems.ts`

| Antes | Después | Notas |
|---|---|---|
| `Por capturar (CxP)` | `Por capturar` | bandeja |
| `Por pagar (CxP)` | `Por pagar` | bandeja |
| `Cuentas por Pagar` | `Facturas de proveedor` | registro maestro |
| `Proveedores` | `Proveedores` | catálogo (sin cambios) |

El prefijo "CxP —" se vuelve redundante porque ya viven dentro del drawer **Compras**.

### 2. Orden estándar dentro del drawer "Compras"

Aplicado a contador, tesorero, auxiliar_contable, admin, admin_org y super_admin (los que ya muestran el drawer):

```
Compras
├── Por capturar          (bandeja — recibir facturas nuevas)
├── Por pagar             (bandeja — programar pagos, solo si rol lo permite)
├── Facturas de proveedor (registro maestro CRUD)
└── Proveedores           (catálogo)
```

Lógica por rol (sin cambiar permisos, solo orden):

- **contador / auxiliar_contable**: Por capturar → Facturas de proveedor → Proveedores
- **tesorero**: Por capturar → Por pagar → Facturas de proveedor → Proveedores
- **admin / admin_org / super_admin**: Por capturar → Por pagar → Facturas de proveedor → Proveedores

### 3. Agregar subtítulo descriptivo opcional (solo si cabe)

Mantener simple: solo renombrar e reordenar. Sin tooltips nuevos en esta iteración.

## Archivos a tocar

1. `src/components/layout/sidebarItems.ts`
   - Renombrar `"Por capturar (CxP)"` → `"Por capturar"`
   - Renombrar `"Por pagar (CxP)"` → `"Por pagar"`
   - Renombrar `"Cuentas por Pagar"` → `"Facturas de proveedor"`
2. `src/hooks/layout/useAppSidebarSections.ts`
   - En cada builder con drawer **Compras** (`buildContador`, `buildTesorero`, `buildAuxiliarContable`, `buildAdmin`), reordenar `items` para que el orden sea: bandejas → `/cxp` → `/proveedores`.
3. `CHANGELOG.md` + `src/constants/appVersion.ts`
   - Bump a `13.98.2` con entrada describiendo la reorganización.
4. Verificar tests:
   - `src/routes/__tests__/appRoutes.smoke.test.tsx` (no debe romperse, solo cambia labels)
   - `src/hooks/layout/__tests__/useLayout.test.tsx` si valida labels específicos.

## Lo que NO se cambia

- Rutas (`/cxp`, `/cxp/por-capturar`, `/cxp/por-pagar`) intactas.
- Permisos por rol intactos (mismo `guarded(...)` en `appRoutes.tsx`).
- Títulos internos de cada página (PageHeader) intactos — solo cambian las etiquetas del sidebar.
- Drawers Facturación, Tesorería, Profit, etc. sin tocar.

## Verificación

- `bunx vitest run` debe pasar.
- Visual: entrar como contador, tesorero y admin a `/inicio` y confirmar que el drawer Compras muestra los 4 ítems en el orden definido y con los nuevos nombres.
