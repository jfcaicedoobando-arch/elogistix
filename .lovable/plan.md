

Re-auditoría tras v8.25.0 → v8.29.0. El plan original ya está completo (10/10). Reviso qué deuda real queda hoy.

## Estado actual (lo ya resuelto)
✅ Badge con forwardRef · ✅ select() explícito en hooks de embarque/cotización/cliente/proveedor/portal/bitácora · ✅ staleTime 30 min en catálogos · ✅ React.memo en cards de Dashboard · ✅ prefetch on hover en Embarques/Cotizaciones · ✅ visualizer integrado · ✅ chunks vendor separados · ✅ lazy loading de páginas

## Deuda restante detectada

### 🔴 Alto impacto
1. **Changelog.tsx pesa ~32 kB gzip** — todas las entradas son strings estáticos en un solo módulo. Aunque está lazy-loaded, cuando un usuario abre Changelog descarga todo. Solución: paginar/virtualizar (mostrar últimas 20, "cargar más") o partir el array en chunks por año.
2. **`dashboard_stats` RPC monolítico (>30 kB)** — sigue retornando 8 secciones aunque el usuario solo vea KPIs arriba del fold. Partir en `dashboard_summary` (rápido, KPIs + conteos) y `dashboard_details` (listas largas, lazy). Pendiente del plan original (#5, marcado como diferido).

### 🟡 Medio impacto
3. **`useClientes` y `useProveedores` paginados sin `placeholderData`** — al cambiar página parpadea el skeleton. Ya se hizo en `useBitacora` y `useEmbarquesPaginados`; falta replicar.
4. **`OrganizationContext` re-renderiza todos los consumidores** cuando cambia cualquier campo. Vale la pena partir en dos contextos (org actual vs lista de orgs) o memoizar el `value`.
5. **`AppSidebar` recalcula alertas en cada render del layout** — verificar si `useSidebarAlerts` tiene `staleTime` razonable y si los items del menú están memoizados.

### 🟢 Bajo impacto / opcional
6. **`recharts` (~97 kB gzip)** carga solo en Dashboard/Reportes — ok, pero si quisiéramos bajar más, `lightweight-charts` o `visx` son alternativas.
7. **Iconos lucide** — confirmar que se importan por nombre individual (tree-shaking), no como `import * as Icons`.
8. **Preload de rutas frecuentes** tras login (Embarques, Cotizaciones, Dashboard) con `import()` en idle — TTI percibido mejor.

## Recomendación de orden
| # | Acción | Esfuerzo | Ganancia |
|---|--------|----------|----------|
| 1 | Paginar Changelog (mostrar 20, botón "ver más") | XS | -85% peso del chunk Changelog |
| 2 | Memoizar `value` de `OrganizationContext` + split en 2 contextos | S | Menos re-renders globales |
| 3 | `placeholderData` en `useClientes`/`useProveedores` paginados | XS | UX paginación sin parpadeo |
| 4 | Partir `dashboard_stats` en summary + details RPC | M | TTFB Dashboard 2–3x |
| 5 | Auditar imports de lucide-react (grep `import \*`) | XS | Confirma tree-shaking |
| 6 | Preload idle de Embarques/Cotizaciones tras login | S | Navegación instantánea post-login |

**Sugerencia**: empezar por #1 + #3 + #5 (todos XS, sin riesgo). Luego #2. Dejar #4 para cuando el dashboard se sienta lento de nuevo (requiere migración SQL).

No hago cambios todavía — espera tu aprobación para ejecutar.

