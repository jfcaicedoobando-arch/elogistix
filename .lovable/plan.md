## Objetivo

Agrandar el logo de Libre Carga en el sidebar y mejorar su estética, manteniendo la altura del header en **64px (h-16)** para no romper la simetría con el topbar lograda en v8.99.36.

## Diagnóstico

Logo actual: `h-8 w-8` (32px) con `bg-white p-0.5 ring-1`. Se ve pequeño y "perdido" dentro del header de 64px, sobre todo cuando hay 32px de espacio vertical libre para crecer.

## Cambios

### 1. `src/components/layout/AppSidebar.tsx` — header del sidebar

**Modo expandido:**
- Logo: `h-8 w-8` → `h-10 w-10` (40px, +25%, mejor presencia sin tocar los 64px del header).
- Mejorar acabado del recuadro del logo:
  - Padding interno `p-0.5` → `p-1` (más respiración alrededor del PNG, evita que toque el borde).
  - Radio `rounded-lg` → `rounded-xl` (más suave, alineado con el sistema de elevación premium del proyecto).
  - Sombra sutil `shadow-card` (token de marca ya existente) para dar profundidad sobre el fondo del sidebar.
  - Mantener `bg-white` y `ring-1 ring-sidebar-border dark:ring-0` (necesario porque el PNG tiene fondo claro y se ve mal directo sobre el navy del sidebar).
- Tipografía:
  - "Libre Carga" sube de `text-sm` a `text-base` con `tracking-tight` (más impacto y peso visual al lado del logo más grande).
  - Subtítulo (organización) se mantiene `text-xs text-sidebar-foreground/60 truncate`.
  - Gap del flex se mantiene en `gap-3`.

**Modo colapsado (icon mode, ancho 3rem):**
- Logo: `h-8 w-8` → `h-9 w-9` (36px), centrado. No usamos 40px porque en colapsado el ancho disponible es de ~48px y queremos margen visual.
- Mismo padding y radio para consistencia.

### 2. Changelog
Entrada **v8.99.37** en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`:
- Tipo: `patch`
- Título: "Logo del sidebar más grande y estético"
- Descripción breve sobre el upscale del logo, padding/radio/shadow refinados y bump tipográfico de "Libre Carga".

## Resultado esperado

Logo claramente visible y con mejor presencia de marca (40px expandido, 36px colapsado), recuadro con esquinas más suaves y sombra sutil que lo hace ver "premium", y la línea horizontal del header sigue alineada perfectamente con el topbar.
