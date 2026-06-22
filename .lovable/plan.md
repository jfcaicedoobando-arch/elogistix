## Reacomodo sidebar — perfiles contables al estilo Odoo

Hoy los roles contables (`contador`, `tesorero`, `auxiliar_contable`, `ejecutivo_cobranza`) ven todo apilado bajo "Gestión". En Odoo el menú separa claramente **Compras** (lo que pagas a proveedores) y **Facturación** (lo que cobras a clientes). Replicamos esa lógica.

### Mapeo de módulos existentes a los nuevos grupos

```text
Compras          → /cxp, /cxp/por-capturar, /cxp/por-pagar, /proveedores
Facturación      → /facturacion, /facturacion/por-emitir, /proformas,
                   /cartera (cobranza), /comisiones
Tesorería        → /tesoreria
```

`Profit`, `Reportes`, `Directorio` (clientes) y `Sistema` quedan como bloques propios.

### Nuevo orden por rol

**Contador** (visión completa)
1. Dashboards
2. **Compras** — Por capturar (CxP) · CxP · Proveedores
3. **Facturación** — Por emitir · Facturación · Proformas · Cobranza · Comisiones
4. Tesorería
5. Profit
6. Reportes
7. Directorio (Clientes)
8. Sistema (Ayuda · Bitácora)

**Tesorero** (foco en pagos y bancos)
1. Dashboards
2. **Compras** — Por capturar · Por pagar · CxP · Proveedores
3. Tesorería
4. **Facturación** — Cobranza · Comisiones
5. Profit · Reportes
6. Sistema

**Auxiliar contable** (captura)
1. **Compras** — Por capturar · CxP · Proveedores
2. Sistema

**Ejecutivo de cobranza**
1. **Facturación** — Cobranza · Facturación · Proformas
2. Directorio (Clientes)
3. Sistema

Roles no contables (vendedor, customer service, coordinador, pricing, gerentes, admin) se quedan igual — el cambio sólo aplica a los 4 perfiles financieros.

### Detalles técnicos

- Editar `src/hooks/layout/useAppSidebarSections.ts`:
  - Añadir dos helpers `filterCompras(urls)` y `filterFacturacion(urls)` que filtren sobre `SIDEBAR_GESTION_ITEMS` + `SIDEBAR_BANDEJAS_ITEMS` + `SIDEBAR_DIRECTORIO_ITEMS` según el grupo.
  - Reescribir `buildContador`, `buildTesorero`, `buildAuxiliarContable` y `buildEjecutivoCobranza` con el nuevo orden.
- **No** cambiar `sidebarItems.ts`, rutas ni permisos: sólo el agrupamiento visual del menú.
- Actualizar el test `src/hooks/layout/__tests__/useLayout.test.tsx` para reflejar los nuevos labels (`Compras`, `Facturación`) por rol.
- `APP_VERSION` → `13.98.0` (cambio de UX visible) y entrada en `CHANGELOG.md`.

### Validación

- `bunx vitest run src/hooks/layout` debe pasar.
- Smoke visual: entrar como Contador / Tesorero / Auxiliar / Cobranza y verificar el nuevo orden y que cada link sigue navegando a su ruta.

Analogía: hoy todo está en un cajón llamado "Gestión". Vamos a separar en dos cajones — uno para lo que **pagas** (Compras) y otro para lo que **cobras** (Facturación), igual que Odoo.

¿Procedo con esta agrupación o quieres ajustar qué módulos van en cada cajón?
