## Diagnóstico visual (lo que vi)

Capturé el landing en `/` a 1440×900 y a página completa. Encontré **un problema crítico que no es del logo**:

- **El hero y casi todo el landing se ven en azul eléctrico**, no en el navy profundo de "Navy Trust".
- Causa raíz: el landing usa tokens semánticos (`bg-primary`, `text-primary-foreground`, `bg-background`, etc.) que en `index.css` cambian con el tema:
  - Light: `--primary: 216 47% 20%` (navy correcto).
  - Dark: `--primary: 217 91% 60%` (azul brillante — el que se está viendo).
- El navegador/usuario está en modo oscuro, así que el landing "marketing" hereda los tokens de la app interna y pierde su identidad.
- **El logo en sí está bien** (variante `librecarga-icon-light.svg` con buen contraste sobre fondo oscuro). El problema es que el fondo no es el navy que diseñamos, así que el conjunto se ve plano y "demasiado azul", lo que da la impresión de que el logo está mal.

También detecté oportunidades de pulido (jerarquía, ritmo, mockup) ahora que el fondo se va a ver como debe.

---

## Plan

### 1. Bloquear el landing en paleta Navy Trust (independiente del tema de la app)

Objetivo: el landing público siempre se ve igual aunque el usuario tenga la app interna en dark mode.

- En `src/pages/marketing/Landing.tsx`, envolver todo en un contenedor con scope propio (`<div className="landing-scope">...`) y forzar `color-scheme: light`.
- En `src/index.css`, agregar un bloque con tokens fijos solo dentro de `.landing-scope`, sin tocar light/dark globales:
  ```css
  .landing-scope {
    color-scheme: light;
    --background: 210 30% 99%;
    --foreground: 216 47% 12%;
    --primary: 216 47% 14%;          /* navy más profundo, "Navy Trust" */
    --primary-foreground: 210 40% 98%;
    --accent: 217 91% 60%;            /* azul eléctrico solo como acento */
    --accent-foreground: 0 0% 100%;
    --muted: 216 30% 18%;
    --muted-foreground: 215 20% 70%;
    --border: 216 30% 22%;
    --card: 216 47% 16%;
    --card-foreground: 210 40% 98%;
  }
  ```
- Resultado: secciones con `bg-primary`/`bg-background` se ven navy/crema correctas, los CTAs en `bg-accent` mantienen el azul eléctrico como acento (no como fondo dominante).

### 2. Mejoras de UX/UI prioritarias (alcance acotado, solo CSS/JSX)

Como experto de diseño, estas son las mejoras que aplicaría ahora que el navy se respeta:

**Hero (`LandingHero.tsx`)**
- Reducir saturación de los blobs (`bg-accent/35` → `/20`) para que el fondo no compita con el H1.
- Añadir un sutil gradiente vertical (`from-primary via-primary to-[hsl(216_50%_10%)]`) para profundidad.
- Subir el contraste del eyebrow chip (borde y fondo un poco más opacos).
- Mockup del embarque: pasar el badge "En tránsito" a `bg-accent/20 text-accent` para introducir el azul como acento real, no como decoración fría.

**Ritmo de secciones (alternancia)**
- `LandingModulos` y `LandingPortal` quedan sobre `bg-primary` (navy).
- `LandingComoFunciona` y `LandingMexico` pasan a `bg-background` (cream claro) con texto `text-foreground` para crear respiración y romper la "pared azul".
- `LandingSeguridad` regresa a navy, `LandingPrecio` a cream con el card de precio en navy — invierte para destacar.

**Jerarquía tipográfica**
- H2 de secciones a `text-4xl md:text-5xl`, `leading-[1.1]`, `tracking-tight`.
- Eyebrows uniformes: `text-xs font-semibold uppercase tracking-[0.18em] text-accent` en secciones oscuras, `text-primary` en claras.

**Tarjeta de precio (`LandingPrecio.tsx`)**
- Reducir el halo (`blur-3xl opacity` ↓).
- Badge "Lanzamiento" más sólido (`bg-accent text-accent-foreground`).
- "Gratis. Para siempre." como H2 con `text-5xl` y `$0 MXN/mes` como dato secundario más pequeño.

**Footer (`LandingFooter.tsx`)**
- Confirmar variante light del logo + agregar línea fina divisora navy/blanca al 8% para separar del CTA final.

**Microinteracciones (sin librerías nuevas)**
- `hover:-translate-y-0.5 transition` en cards de módulos.
- `transition-colors` en links de nav.

### 3. Versionado y registro
- Bump `APP_VERSION` → `12.52.2`.
- Entrada en `CHANGELOG.md` raíz: "Landing: paleta Navy Trust bloqueada (independiente del tema), ritmo de secciones alternado, pulido tipográfico y de mockup."

---

## Detalles técnicos

- **Sin cambios** en lógica, rutas, RLS, tablas, ni en la app interna.
- **Sin cambios** en `BrandLockup` ni en tokens light/dark globales.
- Archivos a editar:
  - `src/index.css` (agregar bloque `.landing-scope`)
  - `src/pages/marketing/Landing.tsx` (wrapper `landing-scope`)
  - `src/pages/marketing/sections/LandingHero.tsx`
  - `src/pages/marketing/sections/LandingModulos.tsx`
  - `src/pages/marketing/sections/LandingComoFunciona.tsx`
  - `src/pages/marketing/sections/LandingMexico.tsx`
  - `src/pages/marketing/sections/LandingPortal.tsx`
  - `src/pages/marketing/sections/LandingSeguridad.tsx`
  - `src/pages/marketing/sections/LandingPrecio.tsx`
  - `src/pages/marketing/sections/LandingFooter.tsx`
  - `src/constants/appVersion.ts`, `CHANGELOG.md`
- Verificación: tras implementar, tomar screenshot a 1440×900 y a 390×844 para confirmar paleta y ritmo.

¿Lo aplico tal cual, o quieres ajustar prioridades (por ejemplo, dejar el ritmo de fondos todo en navy o todo en cream)?