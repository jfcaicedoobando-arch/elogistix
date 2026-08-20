# Cierre de la auditoría visual — Ola G (últimos pendientes)

La mayoría de los 22 hallazgos P1 del documento ya se aplicaron en olas anteriores (tipografía semántica, StatusBadge, aging unificado, ChartTooltip, DataTable/DetailTable, KpiCard, PortalPageShell, guard único de carga, emojis, formatters, AuthCard/LegalShell, variante de tabs). Verifiqué en el código y quedan cinco frentes abiertos.

## Lo que se va a arreglar

1. **Chevrons de fila invisibles (V-15)** — las flechitas de "ver detalle" en Historial de facturas y Historial de proformas usan una opacidad tan baja que casi no se ven. Se suben a color legible con realce al pasar el mouse. Se revisa también el FAB duplicado en Embarques y Cotizaciones (misma acción repetida en el encabezado y en el botón flotante) y se elimina el FAB muerto.

2. **Etiquetas de KPI en MAYÚSCULAS (V-20)** — el estándar del sistema es sin mayúsculas, pero quedan `TotalesPeriodoCard` y `ArribosCardTooltips` con `uppercase` y tamaños minúsculos (`text-2xs`, `text-3xs`). Se normalizan a la escala semántica.

3. **Contraste frágil en fondos suaves (V-17)** — `reconciliacionFormat.ts` y `ClaimPendingBanner` combinan `bg-warning/10` con `text-warning-foreground`, que está pensado para fondo sólido y se pierde en modo oscuro. Se cambia a `text-warning`.

4. **Ancho de página inconsistente (V-13)** — se aplica un criterio único: listado con 6 o más columnas usa ancho amplio. Falta aplicarlo en las rutas de listado que hoy usan el ancho por defecto (proformas, catálogos densos), para que las tablas no "salten" de ancho al cambiar de módulo.

5. **Puntos suspensivos mezclados (V-23)** — se unifica el carácter tipográfico "…" en textos de interfaz (placeholders y botones tipo "Cargando…"), dejando intacto cualquier `...` que sea código o sintaxis.

## Detalles técnicos

- Archivos tocados: `HistorialFacturas.tsx`, `HistorialProformas.tsx`, `Embarques.tsx`, `Cotizaciones.tsx`, `TotalesPeriodoCard.tsx`, `ArribosCardTooltips.tsx`, `reconciliacionFormat.ts`, `ClaimPendingBanner.tsx`, rutas de listado sin `width="wide"`, y una pasada de reemplazo de elipsis en strings de UI.
- Sin cambios de esquema, RPC ni lógica de negocio: todo es presentación.
- Nuevo guardrail de arquitectura (ratchet) que congela el conteo actual de `uppercase` en etiquetas de KPI y de `...` en JSX, para que el código nuevo no reintroduzca la deuda.
- `CHANGELOG.md` + `APP_VERSION` → **13.694.0**.

## Fuera de alcance

Los P2 restantes del anexo (Title Case vs sentence case, unificación de skeletons por carpeta, migración de CxP/Cartera a `ResponsiveDataTable`) quedan para una ola posterior por volumen; el sprint de convergencia de Tesorería (V-21) ya se cubrió con las migraciones de badges y tablas.
