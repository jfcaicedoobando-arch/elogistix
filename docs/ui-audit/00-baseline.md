# Auditoría UI · Capa 0 — Baseline del sistema de diseño

> Fuente de verdad contra la que se auditará el resto de la app.
> Cualquier desviación documentada aquí se marcará como "violación" en capas posteriores.

---

## 1. Tokens de color (`src/index.css`)

### Light mode (`:root`)

| Token | Valor HSL | Uso previsto |
|---|---|---|
| `--background` | `210 30% 99%` | Fondo global de página |
| `--foreground` | `220 40% 12%` | Texto primario |
| `--card` | `0 0% 100%` | Fondo de tarjetas |
| `--card-foreground` | `220 40% 13%` | Texto sobre tarjetas |
| `--primary` | `216 47% 20%` | Navy marca (botones, títulos activos) |
| `--primary-foreground` | `210 40% 98%` | Texto sobre primary |
| `--secondary` | `214 32% 91%` | Botón/pill secundario |
| `--muted` | `210 33% 95%` | Fondo apagado |
| `--muted-foreground` | `215 18% 42%` | Texto secundario, labels |
| `--accent` | `221 83% 53%` | Azul eléctrico CTA/links |
| `--destructive` | `0 84% 60%` | Errores, delete |
| `--border` / `--input` | `214 28% 92%` | Bordes y contornos de input |
| `--ring` | `221 83% 53%` | Focus ring (== accent) |
| `--success` | `142 71% 45%` | Verde OK |
| `--warning` | `38 92% 50%` | Ámbar |
| `--info` | `221 83% 53%` | Azul info (== accent) |

**Sidebar (light):** blanco (`--sidebar-background 0 0% 100%`), no navy sólido.
**Sidebar (dark):** más oscuro que el fondo (`--sidebar-background 220 45% 5%`).

### KPI categóricos

Paleta categórica de 6 colores con variante `-soft` (fondo pastel). Están para
**diferenciar tarjetas**, no para semántica. Solo deben aparecer en KPIs.

`kpi-info | kpi-success | kpi-accent | kpi-warning | kpi-secondary | kpi-danger`

### Tokens de estado de embarque

Categóricos, no semánticos: `state-llegada | state-en-proceso | state-cerrado`.
Solo deben aparecer en badges de estado de embarque.

### Radios

| Token | Valor | Alias Tailwind |
|---|---|---|
| `--radius` | `0.5rem` (8px) | `rounded-lg` |
| `--radius-sm` | `0.375rem` (6px) | `rounded-sm` |
| `--radius-lg` | `0.75rem` (12px) | `rounded-xl` |

**Regla:** todo `rounded-*` fuera de `src/components/ui/` debe usar uno de estos
tres. `rounded-2xl` y `rounded-3xl` son off-system.

### Sombras

| Token | Uso |
|---|---|
| `shadow-card` | Cards estáticas en flujo de página |
| `shadow-raised` | Botones flotantes, popovers ligeros |
| `shadow-overlay` | Dialogs, dropdowns, menús |

**Regla:** `shadow-sm/md/lg/xl` **no** deben aparecer fuera de `src/components/ui/`.
Usar los tokens `shadow-card / raised / overlay`.

---

## 2. Tipografía (`tailwind.config.ts`)

- **Fuente:** `Inter` (única). Loaded en `index.html` con preload+swap.
- **Escala fluida:**
  - `text-display` → `clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)` · weight 700 · line-height 1.15 → **títulos de página**
  - `text-kpi` → `clamp(1.125rem, 0.95rem + 0.8vw, 1.5rem)` · weight 600 · line-height 1.2 → **valores numéricos en KPI**
  - `text-2xs` → `10px` · lh 14px → chips, footnotes
  - `text-3xs` → `9px` · lh 12px → footnotes densas
- **Escala fija Tailwind estándar:** `text-xs (12) · text-sm (14) · text-base (16) · text-lg (18) · text-xl (20) · text-2xl (24)`
- **Ajuste global:** letter-spacing `-0.011em` en body, `-0.018em` en `h1..h4`.

### Regla de uso tipográfica canónica

| Contexto | Clase canónica |
|---|---|
| Título de página | `text-display` (fluid, ~24–36px) |
| Subtítulo de sección | `text-lg font-semibold` |
| Valor KPI | `text-kpi` (fluid) |
| Label de KPI / campo | `text-xs uppercase tracking-wide text-muted-foreground` |
| Body regular | `text-sm text-foreground` |
| Texto secundario | `text-sm text-muted-foreground` |
| Micro (chip, badge) | `text-2xs` (no `text-[10px]`) |
| Weight — headings | `font-semibold` (600) o `font-bold` en `text-display` |
| Weight — cifra dominante | `font-semibold` (600) |
| Weight — body | `font-normal` (400) |

---

## 3. Layout de página canónico

**Contenedor:** `<PageContainer />` (`src/components/shared/PageContainer.tsx`)

```tsx
mx-auto w-full max-w-screen-2xl p-4 sm:p-6   // + space-y-6 salvo noSpacing
```

- `max-w-screen-2xl` = **1536px** → a **1920×1080** deja ~192px de banda a cada
  lado (12% del ancho). **Decisión sistémica**: se acepta esta caja porque
  favorece legibilidad de tablas densas. Todo lo que exceda esta caja es una
  desviación.
- Padding lateral canónico: `p-4` mobile · `p-6` ≥sm. **No** `p-3`, `p-8` en
  wrappers de página.
- Ritmo vertical entre secciones: `space-y-6` (24px). **No** `space-y-4` ni
  `space-y-8` a nivel de página.

**Header de app** (`Layout.tsx`):
- Altura: `h-11 sm:h-12` (44px / 48px).
- Fondo: `bg-card/95` con backdrop-blur.
- Borde inferior: `border-b border-border/60`.
- Padding lateral: `px-3 sm:px-6`.

**Sidebar:** controlado por `SidebarProvider`, colapsa <1024px.

---

## 4. Componentes canónicos (UI kit)

### Button (`src/components/ui/button.tsx`)
Variantes esperadas: `default | secondary | outline | ghost | destructive | link`.
Tamaños: `default | sm | lg | icon`.
**Regla:** ningún `<button className="bg-primary text-white px-4 py-2 rounded-md">` inline.

### Card (`src/components/ui/card.tsx`)
Estructura canónica:
```tsx
<Card>
  <CardHeader>
    <CardTitle />        {/* text-lg font-semibold */}
    <CardDescription />  {/* text-sm text-muted-foreground */}
  </CardHeader>
  <CardContent />
</Card>
```
Sombra: la variante base ya trae `shadow-card`. **No** aplicar `shadow-sm/md`
por encima.

### Dialog / Sheet
Todos los modales de formulario deben pasar por **`FormDialogShell`** +
`FormDialogSection` (regla ya existente en memoria del proyecto). Un `<Dialog>`
crudo con clases custom se considera "parche".

### Table (`src/components/ui/table.tsx`)
- Densidad canónica: filas altura por defecto de shadcn (`py-3` cell).
- Zebra-striping: usar utilidades del proyecto (memoria `ui-visual-standards`).
- Header: `text-xs uppercase tracking-wide text-muted-foreground`.

### Badge (`src/components/ui/badge.tsx`)
Variantes shadcn + variantes de estado. **Regla:** no usar `<span className="bg-...
text-... px-2 py-0.5 rounded-full">` — siempre `<Badge variant=...>`.

### Tabs (`src/components/ui/tabs.tsx`)
Un solo estilo: pestañas con underline debajo. Cualquier tab implementado con
`<button>` custom (ej. barra fiscal) es candidato a normalizar.

---

## 5. Escala de spacing

Escala aceptada (Tailwind base): **`1, 2, 3, 4, 6, 8, 12, 16`**.
`p-5`, `p-7`, `gap-5`, `gap-7` son off-system.

| Contexto | Valor |
|---|---|
| Padding cell tabla | `px-4 py-3` |
| Padding card | `p-4` o `p-6` (según densidad) |
| Gap dentro de toolbar | `gap-2` (compacto) / `gap-3` (default) |
| Gap grid de KPIs | `gap-4` |
| Space-y entre secciones de página | `space-y-6` |
| Space-y dentro de card | `space-y-3` o `space-y-4` |

---

## 6. Reglas contra las que se audita

Estas son las **reglas duras** que aplico en Capa 1 y siguientes:

1. **No color hardcoded fuera de tokens**: `text-white`, `bg-white`, `bg-black`,
   `text-gray-*`, `bg-[#hex]` no deben aparecer fuera de `src/components/ui/`,
   `src/generators/**` (PDF), `src/pdf/**` o `src/features/marketing/**`
   (landing/logo con paleta fija).
2. **No `max-w-7xl / 6xl / 5xl / 4xl` en wrappers de página** (el canónico es
   `max-w-screen-2xl` vía `PageContainer`).
3. **No `rounded-2xl` / `rounded-3xl`** fuera de UI kit.
4. **No `shadow-sm/md/lg/xl`** fuera de UI kit — usar `shadow-card/raised/overlay`.
5. **No `text-[10px]` / `text-[9px]`** — usar `text-2xs / text-3xs`.
6. **No tab bars custom** — usar `Tabs` shadcn.
7. **No `<Dialog>` con clases custom para formularios** — usar `FormDialogShell`.
8. **Sidebar y header no se re-implementan** por módulo (portal-agente y portal
   tienen sus propios layouts; se auditan por separado en Capa 3 tranche D).

---

_Última actualización: v13.219.4_
