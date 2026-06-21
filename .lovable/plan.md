
# Auditoría visual — vistas móvil (390×844, iPhone)

Capturé las pantallas principales con tu sesión real: Inicio, Embarques, Cotizaciones, Clientes, Facturación, Reportes, Operaciones y el sidebar abierto. Abajo va lo que encontré y, al final, una lista priorizada de mejoras concretas. Si la apruebas, paso a build y voy implementando por bloques (P0 → P2), bumpeando `APP_VERSION` y actualizando `CHANGELOG.md` por cambio.

## Hallazgos por pantalla

**Inicio (`/inicio`)**
- "Buenos días, Isela martinez ▢" → el emoji (probablemente 👋) renderiza como cuadro vacío.
- Cifras KPI gigantes se truncan: "MXN 1,53…" / "MXN 737,…". Tipografía `text-4xl/5xl` no cabe en 390px.
- Banner-pill "MXN 737,760.00 vencido · MXN 1,532.32 por pagar · 29 por timbrar" se rompe en 2 líneas dentro de una píldora sola → ilegible.
- Aging chart: labels bajo cada barra (`MXN 1…`, `MXN 2…`) truncados; los importes no son tapeables.
- Falta CTA rápida (Nuevo embarque / Nueva cotización) sin abrir el menú.

**Embarques (`/embarques`)**
- Entre el título "137 contenedores" y el buscador hay un hueco vertical enorme con "…" centrado (parece KPI strip vacío/colapsado o overflow menu mal posicionado).
- Las cards de embarque están bien, pero las pills de estado ("Confirmado", "En Tránsito") son anchas y dejan poco espacio al título.
- Encabezado "Ordenado por Expediente ↓ · global / Quitar orden" pesa demasiado para mobile.

**Cotizaciones (`/cotizaciones`)**
- Mismo bloque "…" en blanco gigante arriba (probable `MoreActionsMenu` desktop rompiendo en mobile).
- KPI cards en 2×2 OK, pero "Tasa de conversión 26.7%" se ve más pequeña que el resto (jerarquía inconsistente).

**Clientes (`/clientes`)**
- ❌ NO usa `ResponsiveDataTable` con `mobileCard`: se renderiza la tabla escritorio con scroll horizontal; columnas "Nombre", "RFC", "Ciudad" cortadas con "…" y RFC visible en lugar de info útil.
- FAB "+" flotante tapa la última fila (sin `padding-bottom` y sin `aria-label`).

**Facturación (`/facturacion`)**
- Card "Hueco de Facturación": título a la izquierda y "29 embarques · USD … · MXN …" alineado a la derecha sin wrap → desborda y se ve cortado.
- KPI "POR TIMBRAR 22" y "COBRADO MES MXN 0" en 2 col, pero las mini-charts "Últimos 6 meses · MXN" tienen "Sin datos" desalineado del label "COBRADO".
- Botón "Nueva factura manual" full-width: bien, pero el acordeón "¿Cómo funciona este módulo?" lo separa del contenido (mucho whitespace).

**Reportes / Rentabilidad (`/reportes/rentabilidad`)**
- Botones "PDF" y "Exportar CSV" grandes en fila → en lugar de 2 botones, un solo menú "Exportar ▾".
- Gráfica horizontal "Top 4 por Profit": labels Y truncados ("Importadora Global…"), eje X superpone "$-1360 $38.6k $70.0k".
- KPI "Revenue total USD" muestra "USD 89…" truncado.

**Operaciones (`/operaciones`)**
- Select "Este mes" full-width gigante (debería ser chip compacto).
- KPIs OK; "Alertas 13 · 4 críticos · 9 en puerto" se lee bien.

**Sidebar (abierto)**
- Texto "Plataforma de Forwarders" se sale a la derecha (overflow visible).
- Email del footer "isela.martinez@elogisti…" desborda y rompe el layout del avatar.
- Buen contenido pero falta jerarquía visual; los `SectionLabel` son muy pequeños.

**Header global**
- Tap targets pequeños: `SidebarTrigger`, búsqueda, notif, tema (~32-36px). Mínimo recomendado 44×44.
- Búsqueda abre dialog: bien, pero el icono `Search` aparece dentro de un cuadro pintado mientras el resto son fantasma → inconsistente.
- `FeedbackButton` ya está oculto en `<sm` ✅.

## Mejoras priorizadas

### P0 — bloquean uso real en celular
1. **Clientes → cards móviles** (igual patrón que `ResponsiveDataTable.mobileCard`): nombre + RFC + ciudad + chip de estado; quitar scroll horizontal.
2. **Eliminar el "…" gigante** en Embarques y Cotizaciones: revisar `MoreActionsMenu`/header secundario para que no consuma altura cuando está vacío en mobile.
3. **Auto-shrink de KPIs**: `text-2xl sm:text-4xl` + `tabular-nums` + formateo abreviado (737.8K) para no truncar. Hacerlo en `KpiCard`/`KpiStrip` global.
4. **Banner saludo Inicio**: separar las 3 métricas en chips individuales con icono y color semántico, en lugar de una pill larga que se rompe.
5. **Fix emoji 👋** del saludo: usar `<span role="img" aria-label="saludo">👋</span>` y asegurar font-family con emoji fallback.
6. **Sidebar overflow**: `truncate` en email + `BrandLockup` subtítulo, `min-w-0` en flex padre.

### P1 — usabilidad fuerte
7. **Tap targets 44×44** en header (`SidebarTrigger`, search, notif, theme).
8. **Bottom tab bar móvil** (solo `<sm`): Inicio · Embarques · Cotizaciones · Facturación · Más → evita abrir sidebar constantemente.
9. **FAB "+"** consistente y con `aria-label`, `pb-[env(safe-area-inset-bottom)]` y `mb-20` cuando coexiste con tab bar.
10. **Card "Hueco de Facturación"**: layout vertical en `<sm` (título arriba, métricas debajo en grid 1 col).
11. **Reportes**: agrupar "PDF / Exportar CSV" en un solo botón "Exportar ▾"; aging chart con tooltips tap-able; abreviar labels eje X.
12. **Operaciones**: convertir "Este mes" en chip selector compacto (ancho auto), no full width.

### P2 — pulido
13. **Aging chart Inicio**: cambiar a barras horizontales con labels al lado (legibles) o tooltips tap-able.
14. **Acordeón "¿Cómo funciona este módulo?"** colapsado por defecto y con menos padding vertical en mobile.
15. **Encabezado "Ordenado por… / Quitar orden"** → mover a un icono `SlidersHorizontal` que abra sheet.
16. **Jerarquía sidebar**: aumentar `SectionLabel` a `text-xs uppercase tracking-wide font-semibold` y separadores más sutiles.
17. **Inconsistencia visual icono Search**: usar mismo estilo ghost que el resto del header.

## Detalles técnicos (para cuando implementemos)

- Archivos clave: `src/components/layout/Layout.tsx`, `AppSidebar.tsx`, `KpiStrip.tsx`, `ResponsiveDataTable.tsx`, `features/clientes/**/ClientesList*.tsx`, `features/facturacion/components/HuecoFacturacionCard.tsx`, `features/embarques/**/EmbarquesList*.tsx`, `features/reportes/**`.
- Patrón ya usado en proyecto: `ResponsiveDataTable` con prop `mobileCard` (ver `ReportesTablaClientes.tsx`) → replicar en Clientes/Embarques donde falte.
- Para el bottom tab bar: componente nuevo `src/components/layout/MobileTabBar.tsx`, render condicional con `useIsMobile()` dentro de `Layout.tsx`.
- Para KPIs: helper `formatCompactNumber` (probablemente ya en `lib/formatters`) + clases responsive.
- Cada cambio entra al `CHANGELOG.md` con bump de `APP_VERSION` (regla del proyecto).

## Pregunta antes de implementar

¿Quieres que vaya directo con **P0 + P1** en una sola tanda, o prefieres ir paso a paso (primero P0, validas en celular, y seguimos)? También dime si te late la idea del **bottom tab bar** (#8): es el cambio con mayor impacto en sensación "app móvil", pero es el más opinable visualmente.
