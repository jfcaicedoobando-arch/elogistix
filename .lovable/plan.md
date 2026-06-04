## 1. Diagnóstico del logo

El ícono `/librecarga-icon.svg` usa relleno `#1B2B4B` (navy) sobre el fondo oscuro del nav (también navy), por lo que el cuerpo del contenedor desaparece y sólo se ve la flecha y el contorno azul. Mismo problema en `LandingFooter` (fondo oscuro) y en cualquier surface dark.

**Fix propuesto (concreto, lo implemento ya):**

- Crear `public/librecarga-icon-light.svg` y `public/librecarga-logo-light.svg`: misma geometría pero con relleno blanco/`#F8FAFC` y trazos en `#60A5FA` (accent claro) para contraste AA sobre navy.
- En `LandingNav.tsx` y `LandingFooter.tsx` usar la variante light.
- Subir el tamaño del lockup en el nav: `h-9 w-9` y `text-lg`, con `tracking-tight` y un ligero gap (`gap-2.5`) para mejor balance óptico.
- Mantener el ícono original (navy) para fondos claros (login, app interna). No tocar `BrandLockup` interno.

## 2. Auditoría UX/UI de la landing (recomendaciones priorizadas)

### Prioridad alta (impacto directo en conversión / claridad)

1. **Hero más vendedor**
  - El mockup del dashboard es un placeholder genérico de cajas con texto. Reemplazar por un screenshot real (o ilustración fiel) del módulo de Embarques con BL, contenedores y timeline — es el wow factor real del producto.
  - Añadir un sub-bullet de prueba social arriba del H1 ("+X embarques operados este mes" o "Hecho por forwarders, para forwarders").
  - El gradiente azul plano del hero pesa visualmente; agregar un sutil radial-gradient o grid pattern para profundidad sin ruido.
2. **Jerarquía y ritmo vertical**
  - Las 13 secciones se sienten parejas (mismo padding, mismo ancho). Alternar fondos (navy 950 → navy 900 → un breakpoint blanco/cream para "Hecho para México" o "Portal del Cliente") para crear ritmo y evitar fatiga.
  - Algunas secciones (Cómo funciona, Seguridad) son muy delgadas; subir padding vertical a `py-24 md:py-32` en secciones clave.
3. **Prueba social real**
  - La línea "Pensado para forwarders en CDMX, Manzanillo…" se lee como aspiracional, no como prueba. Si aún no hay logos de clientes, sustituir por una banda de **logos de navieras / puertos / sistemas integrados** (Maersk, MSC, Hapag, APM Terminals, SAT, CFDI 4.0), que sí podemos mostrar legítimamente y refuerza el "hecho para México".
4. **CTA secundario "Ver demo" más fuerte**
  - Hoy es un outline pequeño. Etiquetarlo "Ver demo en 60 segundos" con ícono play, y/o abrir un modal con un loom/screencast en vez de mandar a `/login`. El demo guiado fue la decisión de producto, hay que hacerlo evidente.
5. **Tarjetas de módulos**
  - 6 cards iguales aplanan la jerarquía. Convertir en bento: Embarques + Portal del Cliente ocupando 2 col cada uno con mini-mockup, los otros 4 como cards chicas con sólo ícono + título + 1 línea. Reduce densidad de texto y destaca los diferenciadores reales.

### Prioridad media (pulido visual)

6. **Tipografía**
  - El H1 del hero a `text-5xl md:text-7xl` con `leading-[1.05]` y `tracking-tight` (hoy se ve modesto vs. estándar SaaS).
  - Eyebrows ("TODO EN UNO", "CÓMO FUNCIONA", "PRECIO") están en mayúsculas con `tracking-widest` pero color muy tenue; subir contraste a `text-accent` para que funcionen como anclas visuales.
  - "Una sola tarifa: cero" → cambiar a "Gratis. Para siempre." como H2 + sub "Sin tarjeta, sin límites, sin letra chica."
7. **Card de precio "Gratis"**
  - El glow azul detrás de la card es bonito pero satura. Bajar la opacidad y usar un border `border-accent/40` con halo sutil. Añadir un badge "Lanzamiento" arriba para reforzar urgencia honesta.
8. **"Hecho para México"**
  - El grid 3x2 de features es plano. Añadir íconos (banderita, calendario, candado, mapa, etc.) y separar con dividers sutiles. Hoy se lee como una tabla.
9. **Sección Portal del Cliente**
  - El mockup vacío con sólo 3 filas se ve incompleto. Añadir un mini gráfico (barras stacked) reutilizando el patrón del portal real, y un toggle visual de pestañas ("Embarques · Facturas · Saldos") para mostrar densidad.
10. **Footer**
  - Muy escueto. Añadir columna "Recursos" (blog/guías futuras), enlace a `librecarga.com`, y badges de "Hecho en México 🇲🇽" + "Powered by Lovable Cloud" si quieres señal de stack.

### Prioridad baja (nice to have)

11. **Microinteracciones**: hover lift en cards de módulos, scroll-reveal suave en sections (intersection observer + fade-up 12px). Sin abuso de motion.
12. **Accesibilidad**: revisar contraste de `text-muted-foreground` sobre el hero azul; varios passages pueden quedar bajo AA. Añadir `aria-labelledby` a cada section.
13. **SEO/meta**: añadir og:image dedicada (1200x630) con lockup + claim, hoy no hay; mejora preview en WhatsApp/LinkedIn (canal real de adquisición B2B en MX).
14. **Sticky CTA mobile**: barra inferior fija con "Crear cuenta gratis" cuando se hace scroll >50% — práctica estándar SaaS móvil.

## 3. Qué implemento ahora vs. qué espero confirmación

**Implemento sin más preguntas (alcance de este turno):**

- Fix del logo en nav y footer (sección 1).
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

**Espero tu selección antes de tocar:**

- ¿Cuáles de las 14 mejoras UX/UI quieres que implemente? Sugiero arrancar con un paquete "alto impacto": 1, 2, 3, 5, 6 (hero + ritmo + prueba social real + bento de módulos + tipografía). Puedo hacerlo en un siguiente turno como cambios sólo de presentación, sin tocar lógica.
  Implementa todas las mejoras del plan

### Detalles técnicos

- Archivos nuevos: `public/librecarga-icon-light.svg`, `public/librecarga-logo-light.svg`.
- Archivos editados: `src/pages/marketing/sections/LandingNav.tsx`, `src/pages/marketing/sections/LandingFooter.tsx`, `src/constants/appVersion.ts` (→ `12.52.1`), `CHANGELOG.md`.
- Sin cambios de rutas, lógica, RLS, ni tablas.