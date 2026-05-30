# Pulido del Portal de Clientes — UX/UI (Mobile-first)

Auditoría visual ejecutada con subagente sobre `/portal/*` en mobile (390px) y desktop. Se identificaron 16 hallazgos. El plan los agrupa en 3 oleadas implementables, todas restringidas a presentación (sin tocar lógica de negocio, RLS, ni queries).

Versión destino: **12.25.0**

---

## Oleada 1 — P0 Críticos (mobile rotos)

1. **`src/components/portal/PortalLayout.tsx`** — Eliminar zona muerta de ~200px al fondo en mobile.
   - Quitar el `pb-16` redundante del `<footer>` y ocultar footer en `<sm` (`hidden md:block`). El `pb-24` del `<main>` ya libera espacio para el bottom nav.

2. **`src/components/portal/layout/PortalBottomNav.tsx`** — Agrandar áreas tap.
   - Cada `<Link>` con `min-h-[56px] w-full justify-center py-3`, ícono `h-5 w-5`, label `text-[11px]`. Asegurar que cada celda del grid llene el `safe-area-inset-bottom`.

3. **`src/pages/portal/PortalFacturas.tsx`** + nuevo **`src/components/portal/facturas/PortalFacturasMobileFilters.tsx`** — Espejar el patrón de `PortalEmbarques`: filtros desktop con `hidden sm:flex`, en mobile sólo input de búsqueda + botón "Filtros" que abre un `Sheet` con estado/fechas.

4. **`src/pages/portal/PortalEmbarqueDetalle.tsx`** — Header sin overflow en 390px.
   - Dividir en dos filas: título + ModoIcon en línea 1, badge de estado + meta (`tipo • modo • incoterm`) en línea 2. `h1` responsive `text-xl sm:text-2xl`. Botón "Volver" como ícono cuadrado de 40px en mobile.

## Oleada 2 — P1 Importantes

5. **`src/components/portal/layout/portalNav.ts`** + **`PortalBottomNav.tsx`** — Exponer Perfil en mobile.
   - Agregar item `Perfil` (`User` icon, `/portal/perfil`) y cambiar grid a `grid-cols-5`. Alternativa si queda apretado: reemplazar "Cotizaciones" por "Perfil" (cotizaciones queda en hamburger).

6. **`src/components/portal/PortalLayout.tsx`** / **`PortalBreadcrumbsBar`** — Ocultar breadcrumbs en `<sm` para evitar duplicado con el título del header sticky (`hidden sm:block`).

7. **`src/pages/portal/PortalFacturaDetalle.tsx`** — Botones CTA en mobile.
   - Pasar de `flex flex-wrap` a `grid grid-cols-2 sm:flex sm:flex-wrap`: PDF y XML como `col-span-1`, "Ver embarque" como `col-span-2 sm:col-span-1`. Subir tamaño del label "Total" a `text-sm`.

8. **`src/components/portal/EmbarqueCard.tsx`** — Ruta sin truncar.
   - Ocultar el badge de `tipoLabel` en mobile (`hidden sm:flex`) para liberar ancho a la ruta `origen → destino`.

9. **`src/pages/portal/PortalPerfil.tsx`** — Mover "Cambiar contraseña" fuera del `CardHeader` (al final del `CardContent` como acción secundaria), para que el título "Datos personales" no se trunque.

10. **`src/components/portal/embarqueDetalle/PortalEmbarqueStepper.tsx`** — Estabilizar el cálculo de la línea de progreso (`scaleY` basado en índice/último, en lugar de `calc(% - 1rem)` que se rompe con muchos pasos).

## Oleada 3 — P2 Polish

11. **`PortalKpiGrid.tsx`** — `shortLabel` a `text-xs font-medium` (más legible que `text-[10px]`).
12. **`PortalEmbarqueTimeline.tsx`** — Reemplazar mapa `ICONO_EVENTO` de emojis por íconos Lucide consistentes en todas las plataformas.
13. **`PortalWelcomeCard.tsx`** — Usar la prop `orgName` ya recibida en el subtítulo: `"{orgName} · Consulta el estado..."`.
14. **`PortalEstadoEmbarquesCard.tsx`** — Agregar `focus-visible:ring-2 ring-ring ring-offset-1 rounded-sm` a cada segmento `<Link>` de la barra.
15. **`PortalDashboard.tsx`** — Skeleton mobile: 3 KPIs en `grid-cols-3 h-20` en lugar de 3 stacked `h-32`.
16. **`EmbarqueCard.tsx`** + **`PortalEmbarqueDetalle.tsx`** — Agregar `title="Fecha estimada de salida"` / `"Fecha estimada de arribo"` a ETD/ETA.

---

## Notas técnicas

- Todo es frontend/presentación, sin migraciones, sin cambios a RPCs, sin tocar RLS.
- Usar tokens semánticos (`text-muted-foreground`, `bg-card`, `ring-ring`, etc.) — nada de colores hex en componentes.
- Mantener cada componente ≤200 líneas (Power of 10). El nuevo `PortalFacturasMobileFilters` queda en ~120 líneas siguiendo `PortalEmbarquesMobileFilters` como referencia.
- Verificación: tras cambios, navegar con el subagente al portal en mobile (390x844) y capturar dashboard, lista de embarques, detalle, lista de facturas, detalle factura, perfil. Confirmar que cada P0 se ve resuelto.

## Changelog y versión

- Bump `APP_VERSION` → `12.25.0` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` raíz con `## [12.25.0] - 2026-05-30` y bullets por oleada.

## Fuera de alcance

- Rediseño visual mayor del portal (paleta, tipografía, layout global).
- Nuevas funcionalidades (notificaciones, chat, tracking en tiempo real).
- Cambios a permisos, RPCs, o esquema de BD.
- Refactor de los componentes de la app interna (`/facturacion`, `/embarques`).
