# Auditoría Visual Fase H — Identidad de marca

## Hallazgos (revisión en `https://elogistix.lovable.app` @ 1366px)

### 1. Pantalla de login (`/login`)
- El contenedor blanco del logo es enorme (176×176 px) con bordes y sombra propios; se ve como un "post-it" pegado sobre la card oscura.
- El logo en sí queda chico dentro de ese cuadro; hay aire muerto arriba y abajo.
- No hay título textual de la app — solo el logotipo. El usuario nuevo no ve "Libre Carga" como wordmark independiente.
- El subtítulo "Inicia sesión para continuar" queda flotando, sin jerarquía clara con la marca.
- Falta nombre de la empresa / tenant antes de iniciar sesión (en login multi-tenant es útil al menos un tagline).

### 2. Sidebar interno (`AppSidebar.tsx`)
- Header (h-16) muestra logo 40×40 + "Libre Carga" + `organization.nombre` debajo. El nombre de la org se trunca a 1 línea con `text-xs` opaco al 60% — difícil de leer en orgs con nombre largo.
- En modo claro el logo no tiene fondo blanco (solo en dark via `dark:bg-white`), por lo que en light theme el SVG azul-marino se mezcla con el sidebar también claro.
- "Libre Carga" como wordmark del producto + nombre de org juntos crean ambigüedad: ¿qué es la app y qué es el tenant?
- El footer repite "v8.x · Libre Carga", redundante con el header.

### 3. Portal cliente (`PortalLayout.tsx`)
- Header muestra logo + `orgName` como título principal + "Portal de Cliente" como subtítulo. La marca del producto ("Libre Carga") desaparece — no hay co-branding.
- Logo a 40×40 sin contenedor blanco: en dark theme el SVG azul oscuro se pierde contra el fondo `bg-card`.

### 4. Logo SVG (`public/librecarga-logo.svg` y `assets/librecarga-logo.png`)
- El SVG es un contenedor con flecha — funciona, pero al renderizarlo en cuadros pequeños (32–40 px) los detalles internos (líneas divisorias, círculo, curva) se vuelven ruido.
- No existe versión "wordmark horizontal" (logo + texto "Libre Carga" combinados) ni versión "icono solo" para colapsados.

---

## Plan de mejoras

### A. Componente reutilizable `<BrandLockup>`
Crear `src/components/layout/BrandLockup.tsx` con tres variantes:
- `variant="icon"` — solo isotipo, contenedor adaptativo (fondo blanco con ring sutil en dark, sin fondo en light), tamaños sm/md/lg.
- `variant="horizontal"` — isotipo + wordmark "Libre Carga" + tagline opcional ("Plataforma de Forwarders") al costado.
- `variant="stacked"` — isotipo arriba, wordmark abajo (para login).

Props: `size`, `tagline?`, `subtitle?` (org name), `className`.

Esto centraliza el tratamiento del logo y elimina divergencias entre login / sidebar / portal.

### B. Login (`src/pages/auth/Login.tsx`)
- Reemplazar el bloque blanco gigante por `<BrandLockup variant="stacked" size="md" />` (icono ~64×64 dentro de un círculo `bg-primary/5` con ring fino, no card blanca completa).
- Agregar wordmark **"Libre Carga"** debajo del isotipo (font-bold, `text-xl`, tracking-tight).
- Agregar tagline pequeño: **"Plataforma de gestión para agentes de carga"** (`text-xs text-muted-foreground`).
- Reducir card a `max-w-sm`, padding más equilibrado; "Inicia sesión para continuar" pasa a ser label superior del form, no subtítulo del logo.

### C. Sidebar (`AppSidebar.tsx`)
- Header: usar `<BrandLockup variant="horizontal" size="sm" />` mostrando icono 36×36 + "Libre Carga" como wordmark.
- Mover `organization.nombre` fuera del header: ya existe `OrgSwitcher` justo abajo — eliminar la línea duplicada del header y dejar que el switcher sea la única fuente del nombre de tenant (con prominencia visual mejorada: `text-sm font-medium`).
- En modo colapsado: solo isotipo en cuadro 36×36 con fondo blanco constante (light + dark) para legibilidad uniforme.
- Footer: simplificar a `v{APP_VERSION}` (quitar "· Libre Carga", ya está en el header).

### D. Portal (`PortalLayout.tsx`)
- Header: `<BrandLockup variant="horizontal" size="sm" />` con wordmark "Libre Carga" + subtítulo "Portal de Cliente · {orgName}".
- Mantiene co-branding: el cliente ve la plataforma + su forwarder.
- Mismo tratamiento del icono con fondo blanco constante.
- En sheet móvil aplicar el mismo lockup.

### E. Refresco del logo
Crear `public/librecarga-icon.svg` simplificado (solo contenedor + flecha, sin líneas divisorias internas) optimizado para 24–48 px. Mantener `librecarga-logo.svg` actual para usos grandes (>96 px).

`BrandLockup` elige automáticamente: tamaños sm/md → icon.svg; lg → logo.svg.

### F. Tokens de marca
Agregar a `src/lib/ui/` un módulo `brand.ts` con:
```ts
export const BRAND = {
  name: "Libre Carga",
  tagline: "Plataforma de gestión para agentes de carga",
  taglineShort: "Agente de Carga Digital",
} as const;
```
Reemplazar literales hardcoded ("Libre Carga", "Agente de Carga") en sidebar, login, portal, AdminSidebar y PortalWelcomeCard con `BRAND.*`.

### G. AdminSidebar (`src/components/admin/AdminSidebar.tsx`)
- Hoy usa ícono `Building2` y texto "Libre Carga" / "Super Admin". Reemplazar por `<BrandLockup variant="horizontal" size="sm" subtitle="Super Admin" />` para consistencia.

### H. Changelog + versión
- Bump `APP_VERSION` a `8.115.0`.
- Entrada nueva en `Changelog.tsx` y `src/content/changelog/v8/chunks/0.ts`: "Refinamiento de identidad de marca: nuevo lockup unificado (`BrandLockup`), wordmark consistente en login/sidebar/portal/admin, isotipo simplificado para tamaños chicos."

---

## Archivos a crear / editar

**Nuevos**
- `src/components/layout/BrandLockup.tsx`
- `src/lib/ui/brand.ts`
- `public/librecarga-icon.svg` (versión simplificada del isotipo)

**Editados**
- `src/pages/auth/Login.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/portal/PortalLayout.tsx`
- `src/components/portal/dashboard/PortalWelcomeCard.tsx` (usar `BRAND.name`)
- `src/components/admin/AdminSidebar.tsx`
- `src/constants/appVersion.ts`
- `src/pages/dashboard/Changelog.tsx`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`

## Validación post-implementación
- Visual en `/login`, `/`, `/portal`, `/admin` a 1366px y 1024px.
- Light + dark mode (verificar contraste del isotipo en ambos).
- Sidebar colapsado: isotipo legible.
- Org con nombre largo (>30 chars): truncado limpio en switcher.
