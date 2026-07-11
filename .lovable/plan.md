# Plan: Video demo de 60 segundos de Libre Carga

## Objetivo
Crear un video motion-graphics de 60 segundos (1920x1080, 30fps = 1800 frames) que sirva como creativo principal para ads (Meta/LinkedIn/YouTube) y para embeber en la landing. Renderizado con Remotion en el sandbox y entregado como MP4 en `/mnt/documents/`.

## Dirección creativa

**Marca:** Libre Carga — plataforma multi-tenant para forwarders en México.

**Paleta (memoria del proyecto):**
- Primario `#1B2B4B` (azul marino corporativo)
- Acento `#2563EB` (azul eléctrico)
- Fondo `#F8FAFC` (casi blanco)
- Neutros: `#0F172A` texto, `#94A3B8` secundario

**Tipografía:** Inter (display + body, ya es la tipografía oficial).

**Estilo:** *Tech Product / Editorial* — geométrico, grid limpio inspirado en dashboards, transiciones snappy con springs, motion horizontal tipo "riel logístico" (metáfora sensorial: contenedor deslizándose sobre rieles).

**Motivos visuales recurrentes:**
1. Líneas horizontales que simulan trayectos marítimos.
2. "Cards" de dashboard que aparecen con clip-path reveal.
3. Contador numérico animado para KPIs.

## Guion (60s / 1800 frames)

```text
Escena 1 (0–6s / 180f)   Hook: "El forwarding en México se hace en Excel."
                         Grid de celdas caóticas → colapsa.
Escena 2 (6–14s / 240f)  Reveal marca: logo + tagline "Un sistema. Todo el forwarding."
Escena 3 (14–26s / 360f) Módulos: Cotizaciones → Embarques → Bitácora → CxC/CxP
                         (4 mockups de dashboard con clip-path reveal, stagger).
Escena 4 (26–38s / 360f) KPIs animados: "Minutos para cotizar", "11 módulos",
                         "CFDI 4.0", "SAT + Banxico + UN/LOCODE".
Escena 5 (38–50s / 360f) Trayecto: mapa esquemático CN → MX con timeline
                         auto-generado (metáfora del tracking real).
Escena 6 (50–60s / 300f) Cierre + CTA visual: "librecarga.com / Prueba el demo".
```

Total: 1800 frames exactos.

## Trabajo técnico

### Estructura
```
remotion/
  package.json, tsconfig.json, bun.lockb
  scripts/render-remotion.mjs
  src/
    index.ts, Root.tsx, MainVideo.tsx
    scenes/{Hook,BrandReveal,Modules,Kpis,Route,Cta}.tsx
    components/{PersistentBg,DashboardCard,AnimatedCounter,RouteLine}.tsx
  public/
    images/logo.svg  (copiado desde src/assets si existe)
```

### Pasos
1. **Scaffold Remotion en `remotion/`** con `bun init` + deps (`remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/transitions`, `@remotion/google-fonts`, `@remotion/compositor-linux-x64-musl`, react/react-dom, ts).
2. **Parchar compositor gnu → musl** y symlinks a ffmpeg/ffprobe (obligatorio en NixOS).
3. **`tsconfig.json`** con `jsx: "react-jsx"`, `module: "Preserve"`.
4. **Cargar Inter** vía `@remotion/google-fonts/Inter` a nivel módulo.
5. **Copiar logo** desde `src/assets/` (si existe SVG/PNG) a `remotion/public/images/`.
6. **Construir capas persistentes**: fondo con gradient sutil `#F8FAFC → #E2E8F0` + líneas horizontales flotantes.
7. **Construir 6 escenas** en archivos separados, cada una autocontenida usando `useCurrentFrame()` + `interpolate/spring`. Sin CSS animations, sin `backdropFilter`.
8. **Wire con `<TransitionSeries>`** usando `slide`/`wipe` de `@remotion/transitions` (springTiming ~20f). Ajustar duraciones para compensar overlaps y sumar 1800f.
9. **Textos en español mexicano** (regla del proyecto).
10. **QA de frames clave** con `bunx remotion still` en frames 60, 300, 720, 1080, 1440, 1740; ver PNGs con `code--view` y corregir layout/overflow.
11. **Render final** con `node scripts/render-remotion.mjs` → `/mnt/documents/libre-carga-demo-60s.mp4` (`muted: true`, `chromeMode: "chrome-for-testing"`, `concurrency: 1`).
12. **Verificar** con `ffprobe` que el MP4 dure 60.0s, 1920x1080, 30fps.
13. **Actualizar changelog** (`APP_VERSION` bump + entrada en `CHANGELOG.md`) mencionando el asset y su ruta.
14. **Emitir `<presentation-artifact>`** apuntando al MP4 para que puedas descargarlo.

## Fuera de alcance (no lo hago en este turno)
- Voz en off / música (video mudo; puedes agregar audio después en un editor).
- Subir el video al bucket de Supabase o incrustarlo en la landing (te aviso cuando esté listo y lo hacemos en un turno separado).
- Versiones 9:16 (reel) y 1:1 (feed) — te las puedo generar después si validamos que esta versión te gusta.

## Notas / preguntas menores
- Si tienes un logo específico (SVG) que quieras usar, dímelo o confirmo que use el que ya está en `src/assets/`.
- Si prefieres otro tagline al de la landing ("Un sistema. Todo el forwarding."), dímelo antes de que arranque.

Si te parece bien, apruébalo y lo genero.
