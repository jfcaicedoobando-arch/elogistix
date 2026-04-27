# Plan: Polish Visual Integral (Fase I)

Auditoría enfocada en cohesión, ritmo y "vibe" moderno sin tocar lógica. La app ya tiene una base sólida (tokens HSL, dark mode, design system de tablas/diálogos/empty states de las Fases A-H). Lo que falta es **el último 20% de pulido**: elevación con propósito, ritmo vertical consistente, y micro-refinamientos en los componentes base que se propagan a toda la UI.

## Diagnóstico (lo que veo hoy)

1. **Sombras planas y uniformes**: todo usa `shadow-sm` (1px). No hay jerarquía entre cards informativas y elementos elevados (popovers, dialogs, dropdowns).
2. **Radio inconsistente**: `--radius: 0.5rem` (8px) — moderno pero los inputs/buttons usan `rounded-md` (6px) mientras cards usan `rounded-lg` (8px). Sin ritmo.
3. **Spacing del header**: `h-14` (56px) con `px-4`; el `main` tiene `p-6` (24px). Funciona pero se siente apretado en desktop ancho.
4. **Tipografía de Cards**: `CardTitle` por defecto es `text-2xl` — demasiado grande para subsecciones; los wizards ya lo bajaron a `text-base` ad-hoc.
5. **Inputs/buttons pequeños**: `h-10` con `text-base` en mobile y `text-sm` en md+. El border es `border-input` plano sin focus ring suave.
6. **Sin elevación en hover** para cards interactivas (filas de tabla, KPIs cliqueables) — pierden affordance.
7. **Ausencia de transiciones globales** para cambios de tema y estados hover.
8. **Scrollbar custom** existe pero es fina (6px) y poco visible — bien para minimalismo pero choca con scrollbars nativas en algunas zonas.

## Qué voy a entregar

### 1. Sistema de elevación de 3 niveles
Crear `src/lib/ui/elevation.ts` con tokens semánticos:
- `elevation.flat` — sin sombra (filas de tabla, items de lista)
- `elevation.card` — sombra sutil con tinte del primary, hover ligeramente más fuerte (cards informativas)
- `elevation.raised` — sombra media (cards interactivas, KPIs cliqueables, hover de filas)
- `elevation.overlay` — sombra fuerte (popovers, dropdowns, dialogs)

Definir como variables CSS en `index.css`:
```css
--shadow-card: 0 1px 2px 0 hsl(220 40% 13% / 0.04), 0 1px 3px 0 hsl(220 40% 13% / 0.06);
--shadow-raised: 0 4px 6px -1px hsl(220 40% 13% / 0.06), 0 2px 4px -2px hsl(220 40% 13% / 0.05);
--shadow-overlay: 0 10px 15px -3px hsl(220 40% 13% / 0.10), 0 4px 6px -4px hsl(220 40% 13% / 0.08);
```
En dark mode las sombras suben opacidad (15%) y bajan intensidad para no "quemar".

### 2. Refinamiento de componentes core (impacto sistémico)

**Card** (`components/ui/card.tsx`):
- Sombra cambia de `shadow-sm` plano a `shadow-card` (con tinte de marca)
- `CardHeader` baja de `p-6` a `p-5` (header) + `pb-3` (separación con contenido)
- `CardTitle` baja de `text-2xl` a `text-lg font-semibold tracking-tight` (era inconsistente — 90% de los usos ya lo sobrescribían)
- `CardContent` mantiene `p-6 pt-0` pero queda alineado con el header

**Button** (`components/ui/button.tsx`):
- `default` recibe `shadow-sm` muy sutil + `active:scale-[0.98]` (feedback táctil)
- Tamaños se ajustan a múltiplos de 4: `default h-10 px-4`, `sm h-8 px-3`, `lg h-11 px-6`
- Transición sube a `transition-all` con `duration-150` (era solo colors)

**Input/Textarea/Select** (`components/ui/input.tsx`, etc):
- Border más sutil en idle (`border-border/60`), sólido en focus
- Focus ring usa `ring-2 ring-ring/40 ring-offset-0` (anillo más suave, sin offset duro)
- Altura uniforme `h-10`, `rounded-md`

**Table** (filas):
- Hover row: `bg-muted/40` + `transition-colors duration-100`
- Headers con `text-xs font-medium uppercase tracking-wider text-muted-foreground` (look "stripe-like")

### 3. Layout y header
- Header sube de `h-14` a `h-16` con `px-6` para alinearse con `main p-6` (mismo gutter izquierdo).
- Añadir `backdrop-blur-sm bg-card/95 sticky top-0 z-30` al header (efecto vidrio sutil al scroll).
- `main` recibe `max-w-screen-2xl mx-auto` para evitar que el contenido se estire infinito en monitores 4K.
- Espaciado vertical entre secciones de página: estandarizar `space-y-6` en todas (algunas usan `space-y-5`, otras `space-y-4`).

### 4. Tokens de tipografía y radio

En `index.css`:
- `--radius` se mantiene `0.5rem` (8px) pero se añade `--radius-sm: 0.375rem` (6px para inputs/buttons) y `--radius-lg: 0.75rem` (12px para cards grandes y dialogs) para crear jerarquía visual.
- Añadir `font-feature-settings: 'cv11', 'ss01', 'ss03'` (ya parcialmente activo) + `letter-spacing: -0.011em` al body para tipografía más densa estilo Linear/Vercel.

### 5. Micro-interacciones
- `transition-colors duration-150` global por defecto (clase utility en `@layer base`)
- Sidebar items reciben `transition-all` y un sutil `translate-x-0.5` en hover
- Cards con `onClick` reciben `cursor-pointer hover:shadow-raised hover:-translate-y-0.5 transition-all duration-200`

### 6. Refinamiento del tema claro
- Background sube ligeramente de `210 33% 98%` a `210 30% 99%` (casi blanco, más limpio).
- Border baja de `214 32% 91%` a `214 25% 93%` (más sutil, menos "boxy").
- Muted-foreground sube contraste de `47%` a `42%` (mejor legibilidad WCAG AA).

### 7. Refinamiento del tema oscuro
- Card sube de `220 38% 11%` a `220 35% 13%` (más separación del background `220 40% 7%` → mejor jerarquía).
- Border sube a `217 30% 22%` (más visible sin ser ruidoso).

### 8. Página de cambios v8.99.34 en changelog

## Alcance — QUÉ NO se toca

- Lógica de negocio, hooks, queries, RLS, edge functions: 0 cambios.
- Estructura de rutas y permisos: 0 cambios.
- Componentes de las Fases A-H (PageHeader, EmptyStateInline, KpiCard, ModoIcon, dialogTokens, WizardSection, FormField): se mantienen, sólo heredan las mejoras vía Card/Button/Input refinados.
- Paleta de marca (azul-marino primary, azul eléctrico accent): se mantiene exactamente igual.
- Iconografía Lucide y tamaños: sin cambios.

## Detalles técnicos (para devs)

```text
src/index.css                      → tokens shadow + radius extendidos + tweaks tema
tailwind.config.ts                 → boxShadow custom (card/raised/overlay) + radius extendidos
src/components/ui/card.tsx         → shadow-card, padding y tipografía title
src/components/ui/button.tsx       → shadow-sm, active:scale, transición
src/components/ui/input.tsx        → border sutil, focus ring suave
src/components/ui/textarea.tsx     → idem
src/components/ui/select.tsx       → idem
src/components/ui/table.tsx        → hover row, headers refinados
src/components/ui/dialog.tsx       → shadow-overlay + radius-lg
src/components/ui/popover.tsx      → shadow-overlay
src/components/ui/dropdown-menu.tsx→ shadow-overlay
src/components/layout/Layout.tsx   → header h-16 px-6 sticky blur, main max-w-screen-2xl
src/components/layout/AppSidebar.tsx → micro-transition en items
src/content/changelog/...          → v8.99.34
```

Verificación final: `tsc -p tsconfig.app.json --noEmit` debe pasar limpio. No hay cambios de tipos ni de API pública de componentes — todo es CSS/className.

## Resultado esperado

- Cards con elevación sutil tipo Linear/Notion/Vercel — sensación de profundidad sin ruido.
- Header "vidrio" al hacer scroll que mantiene la marca presente sin estorbar.
- Inputs con focus ring suave (no "agresivo" como hoy).
- Tablas con headers tipo Stripe (uppercase pequeño) — jerarquía clara entre header y filas.
- Buttons con micro-feedback al click.
- Tema claro más blanco y "aireado", tema oscuro con jerarquía card/background más clara.
- Tipografía con `letter-spacing` negativo sutil — densidad estilo SaaS premium.
- Scrollbar y transiciones globales que dan sensación de continuidad.

Todo respetando los tokens HSL existentes — no se introduce ningún color nuevo.
