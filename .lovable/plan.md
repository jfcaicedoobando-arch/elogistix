# Plan P0 — Remediación mobile crítica

Sólo los 3 bloqueantes detectados en la auditoría. Cambios de presentación; sin lógica de negocio ni esquema.

## P0-1 · FAB ya no tapa la última fila de las listas

**Problema:** `FloatingActionButton` (56px, `bottom-6 right-4`, `z-40`) se superpone al último registro en `/clientes`, `/proveedores`, `/cotizaciones`, `/embarques`, `/costeo/*`.

**Solución:** padding inferior global cuando hay FAB visible — opción más limpia que tocar cada página.

1. `src/components/shared/FloatingActionButton.tsx`: el botón se mantiene igual, pero exportar un `MOBILE_FAB_SAFE_PADDING = "pb-24 md:pb-0"` (constante reutilizable).
2. En cada página que renderiza `<FloatingActionButton />` (5 archivos detectados con `rg`), añadir esa clase al wrapper raíz de la página:
   - `src/pages/clientes/Clientes.tsx`
   - `src/pages/proveedores/Proveedores.tsx`
   - `src/pages/cotizaciones/Cotizaciones.tsx`
   - `src/features/embarques/routes/Embarques.tsx`
   - `src/pages/costeo/*` (subpáginas que renderizan FAB — verificar)
3. Si una página usa `ResponsiveDataTable`, el `<ul>` móvil ya queda dentro de ese wrapper → sin cambios adicionales.

## P0-2 · Tablas financieras críticas con vista mobile-card

**Problema:** `/cartera`, `/profit/estado-resultados`, `/profit/presupuesto` cortan cifras en mobile.

**Solución:** migrar las 3 tablas a `ResponsiveDataTable` (ya existente, ya usado en `/embarques`, `/cotizaciones`, `/reportes`, `/proveedores`). Cada una recibe un `mobileCard(row)` con layout vertical de 2 columnas (label izquierda · cifra derecha `text-right tabular-nums`).

1. **`/cartera`** (`src/pages/.../Cartera*.tsx` — localizar): identificar la `<DataTable>` actual, envolverla con `ResponsiveDataTable`, definir `mobileCard` mostrando cliente · saldo total · vencido. Acciones de fila → menú `⋮`.
2. **`/profit/estado-resultados`** (`src/features/profit/components/EstadoResultadosTable.tsx`): mismo patrón. `mobileCard` con concepto + valor por modo (Marítimo / Aéreo / Terrestre) apilados.
3. **`/profit/presupuesto`**: grid editable. Patrón: mostrar lista de filas; en mobile, abrir un Drawer/Sheet para editar la celda (en lugar de inputs inline). Mantener el grid en `≥md`.

Cada cambio debe verificarse con Playwright en `390×844` revisando que las cifras no se corten.

## P0-3 · Inputs y tap targets ≥44px en `<md` (estandarización)

**Problema:** densidad alta de tap targets <44px detectada en todas las listas y formularios.

**Solución (de bajo riesgo, presentación pura):** ampliar el preset `size="icon"` y `size="sm"` de `src/components/ui/button.tsx` para móvil:

- `size="icon"`: actual `h-9 w-9` → `h-11 w-11 md:h-9 md:w-9`.
- `size="sm"`: actual `h-9` → `h-10 md:h-9`.
- `Input`, `Select`, `Textarea` (shadcn defaults en `src/components/ui/`): altura `h-10` → `h-11 md:h-10`.

Esto eleva ~70% de los tap targets reportados sin tocar cada página.

## Verificación

Al terminar, relanzar los 2 sub-agentes de los lotes más afectados (B y D) y comparar:
- `tap_targets_<44px` debe caer ≥40% en `/clientes`, `/proveedores`, `/operaciones`.
- `cartera.png`, `profit-estado-resultados.png` no deben mostrar cifras cortadas en viewport 390.
- FAB no se superpone a la última fila en `/clientes` y `/proveedores`.

## Fuera de alcance

- **Landing público para usuarios autenticados** (originalmente P0-3 de la auditoría): tras revisar `HomeRoute.tsx`, el redirect de `/` → `/inicio` con sesión es intencional y los crawlers SEO siempre lo ven sin sesión. Lo bajo a P2/no-fix.
- **`/embarques/:id` sobrecargado**, warnings de `/crm`, 404 en `/auditoria`: P1/P2, plan separado.
- **Datos reales de `/admin/*` y `/portal/*`**: requieren credenciales con otros roles.

## Changelog

Bump `APP_VERSION` y entrada en `CHANGELOG.md` describiendo: FAB padding, mobile-card en finanzas críticas, tap-targets ≥44px en `<md`.

¿Apruebas?
