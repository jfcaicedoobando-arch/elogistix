# Plan — Completar la landing pública

Resultado de auditoría: hay 3 bloques sin terminar (signup, demo, footer) más algunos CTAs incoherentes. Este plan los cierra sin tocar lógica de negocio del backend.

## 1. Signup real ("Crear cuenta gratis")

Hoy todos los CTAs caen a `/login`, que solo es login. Opciones:

- **A (recomendada, ligera):** agregar pestaña "Crear cuenta" dentro de `src/pages/auth/Login.tsx` (Tabs Login / Signup) usando `supabase.auth.signUp` con email + password + nombre. Mantiene una sola ruta y respeta el "Unified Login" guardado en memoria.
- **B:** crear ruta separada `/signup` con su propia página. Más boilerplate, divide el flujo.

Voy con **A**. Cambios:
- `src/pages/auth/Login.tsx`: envolver formulario en `Tabs` (Iniciar sesión / Crear cuenta). El tab Crear cuenta pide nombre, email, contraseña, confirmación, checkbox de Términos. Llama `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: window.location.origin + '/inicio' } })`. Muestra mensaje "Revisa tu correo para confirmar" (no auto-confirm, según reglas Supabase del proyecto).
- Soportar `?tab=signup` en el query string para que los CTAs del landing aterricen directo en el tab correcto.
- Actualizar destinos en landing para usar `/login?tab=signup`:
  - `LandingHero.tsx`, `LandingPrecio.tsx`, `LandingCtaFinal.tsx`, `LandingNav.tsx` ("Crear cuenta gratis"), `MobileStickyCta.tsx`, `LandingFooter.tsx` ("Crear cuenta gratis").
- "Iniciar sesión" y "Portal del cliente" siguen apuntando a `/login` (tab login por default).

## 2. Demo de 60 segundos

Hoy es texto sin acción. Plan:
- Nueva sección **`LandingDemo.tsx`** insertada entre Hero y Módulos en `Landing.tsx`, con `id="demo"`.
- Contenido: encabezado "Mira Libre Carga en 60 segundos", subtítulo, y un reproductor placeholder (16:9, `aspect-video`, fondo navy con play button y badge "0:60"). Sin video real todavía — usar `<video>` con `poster` y `controls` apuntando a `/demo-libre-carga.mp4` con fallback a un mensaje "Próximamente" si el archivo no existe (manejado con estado `onError`). Esto deja el slot listo y elimina el CTA roto.
- Alternativa visible al usuario: mientras no haya video, el botón "Agendar demo guiada" abre `mailto:` a `FOOTER.contact` con asunto pre-rellenado.
- Reemplazar todos los CTAs "Ver demo en 60 segundos" para que hagan scroll a `#demo` en vez de ir a `/login`:
  - `LandingHero.tsx:58`, `LandingCtaFinal.tsx:34`.

## 3. Footer — arreglar links rotos

Cambios en `LandingFooter.tsx` + nuevas rutas:

| Link | Acción |
|---|---|
| Guías (próximamente) | Quitar del footer hasta tener contenido (evita `href="#"`). |
| Blog (próximamente) | Quitar del footer. |
| Aviso de privacidad | Apuntar a `/legal/privacidad` (nueva ruta y página). |
| Términos y condiciones | Apuntar a `/legal/terminos` (nueva ruta y página). |
| Portal del cliente | Mantener a `/login` (el `Unified Login` ya enruta a portal según rol). |
| Crear cuenta gratis | `/login?tab=signup`. |

Nuevas páginas:
- `src/pages/legal/Privacidad.tsx` y `src/pages/legal/Terminos.tsx` — páginas estáticas en español MX con header simple (logo + volver), contenido placeholder revisable por legal, footer reutilizado. Incluyen `<title>` y meta description vía `react-helmet`-style (o tags directos), con un H1 único.
- Registrar en `src/routes/publicRoutes.tsx`: `/legal/privacidad` y `/legal/terminos`.

## 4. Coherencia general de CTAs

- Auditar en una sola pasada que los 5 CTAs primarios ("Crear cuenta gratis") usen `/login?tab=signup` y los secundarios ("Ver demo") usen `#demo`.
- `LandingPortal.tsx`: el CTA "Conocer portal del cliente" debe ir al ancla correspondiente o a `/login` (no a `#`).
- Smoke visual: hacer click mental sobre Hero, Módulos, Portal, Precio, FAQ, CTA Final, Footer — todo debe resolver.

## 5. Versionado y changelog

- Bump `APP_VERSION` a `12.53.0` (cambio menor con features visibles).
- Entrada en `CHANGELOG.md` describiendo: signup en Login con tabs, sección demo con slot de video, páginas legales, footer saneado.

## Detalles técnicos

- Signup: respetar reglas del proyecto — **no** habilitar auto-confirm de email; mostrar mensaje de verificación. Usar Tabs de shadcn (`@/components/ui/tabs`).
- Demo video: el archivo `public/demo-libre-carga.mp4` no se incluye en este cambio (queda en el slot con fallback "Próximamente"). El usuario podrá subirlo después arrastrando el archivo al proyecto.
- Páginas legales: contenido placeholder claramente marcado como "Borrador — pendiente de revisión legal" para que el usuario lo sustituya.
- Sin migraciones ni cambios de schema. Sin secrets nuevos.
- Conservar Power of 10: componentes ≤200 líneas, sin `any`, cleanup en effects.

## Archivos tocados

Editar:
- `src/pages/auth/Login.tsx`
- `src/pages/marketing/Landing.tsx`
- `src/pages/marketing/sections/LandingHero.tsx`
- `src/pages/marketing/sections/LandingCtaFinal.tsx`
- `src/pages/marketing/sections/LandingNav.tsx`
- `src/pages/marketing/sections/LandingFooter.tsx`
- `src/pages/marketing/sections/LandingPrecio.tsx`
- `src/pages/marketing/sections/LandingPortal.tsx`
- `src/pages/marketing/sections/MobileStickyCta.tsx`
- `src/pages/marketing/landingCopy.ts` (textos del demo y footer)
- `src/routes/publicRoutes.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

Crear:
- `src/pages/marketing/sections/LandingDemo.tsx`
- `src/pages/legal/Privacidad.tsx`
- `src/pages/legal/Terminos.tsx`

## Fuera de alcance

- Grabar/editar el video real de 60s (solo se deja el slot).
- Redactar el texto legal definitivo (placeholder).
- Cambios en el dashboard o flujos post-login.
