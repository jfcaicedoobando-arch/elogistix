# Mejorar el landing de librecarga.com

Reestructura media del inicio público: mismo contenido veraz que hoy (no inventamos testimonios ni cifras), mejor orden, mensaje más claro, más confianza y mejor posicionamiento en Google.

## Situación actual

La página ya tiene: portada con maqueta de un embarque, demo, seis módulos, cómo funciona, "hecho en México", portal del cliente, seguridad, recursos, precio $0, preguntas frecuentes, cierre y pie. También tiene título/descripción, imagen para redes, sitemap y robots.

Lo que le falta o estorba:
- La portada carga demasiado: insignia, frase social, subtítulo, dos botones, aviso, maqueta, navieras, estándares y tres cifras, todo antes de bajar. Diluye la decisión.
- El precio "Gratis para siempre" aparece muy abajo, aunque es el argumento más fuerte.
- No hay un bloque que muestre el antes/después (Excel + WhatsApp vs. Libre Carga), que es lo que realmente convence a una agencia.
- La confianza se apoya en logos de navieras que no son clientes; se puede reforzar con hechos verificables (aislamiento por agencia, bitácora, DOF, CFDI) presentados como garantías, no como decoración.
- Falta un recorrido visual del producto: hoy sólo hay una maqueta dibujada.

## Cambios propuestos

### 1. Portada más decidida
- Un solo mensaje principal, un subtítulo corto y dos botones (crear cuenta / ver demo).
- Mover la insignia de "gratis" al mensaje principal y quitar la frase repetida.
- Bajar las navieras y los estándares a una franja discreta debajo, sin las tres cifras (que hoy compiten con los botones).
- Mantener la maqueta del embarque, con un poco más de aire.

### 2. Nuevo bloque "Antes y después"
Comparativa honesta en dos columnas: cómo se opera hoy (Excel por embarque, carpetas compartidas, cliente preguntando por WhatsApp, cobranza en otra hoja) frente a cómo queda con Libre Carga. Sin cifras inventadas; sólo capacidades que ya existen en el sistema.

### 3. Precio y garantías más arriba
- Subir el bloque de precio justo después de "cómo funciona", para que el "$0" llegue antes de que la persona se canse.
- Convertir seguridad en un bloque de "garantías" con lenguaje llano: cada agencia aislada, bitácora de quién hizo qué, respaldos diarios, tipo de cambio oficial del DOF, IVA configurable.

### 4. Recorrido del producto
Sección de pestañas ligeras (Cotización → Embarque → Cobro) con la maqueta de cada paso construida con los mismos componentes de la app, para que se vea el producto real sin necesitar capturas. Cuando tengas capturas reales, se sustituyen sin tocar la estructura.

### 5. Refresco visual
Mantener la identidad (azul marino y acento azul, Inter). Ajustes: más aire entre secciones, alternar fondos claro/oscuro para marcar ritmo, tarjetas con un borde y sombra consistentes, y animación suave de entrada al hacer scroll (respetando la preferencia de "menos movimiento").

### 6. SEO y contenido
- Títulos y descripción orientados a lo que busca una agencia mexicana ("software para agencias de carga en México", "sistema para freight forwarder").
- Un solo H1 y jerarquía correcta de subtítulos por sección.
- Enlaces internos desde el inicio a las tres guías que ya existen (Carta Porte, Incoterms, puertos de México) y desde esas guías de vuelta al inicio.
- Datos estructurados de producto/software además de las preguntas frecuentes que ya están.
- Agregar las páginas legales y de ayuda al mapa del sitio, y revisar que cada página tenga su propia descripción.
- Imágenes con texto alternativo y carga diferida en lo que está debajo del pliegue.

### 7. Fricción en el registro
- Botón fijo en celular con el mismo texto que el principal (hoy existe, se alinea el mensaje).
- Recordar de dónde llegó la visita (ya se captura) para no perder el origen al crear la cuenta.

## Fuera de alcance

- No se inventan testimonios, logotipos de clientes ni cifras de uso. Se dejan huecos listos para cuando los tengas.
- No se toca el sistema interno (embarques, cotizaciones, facturación) ni la base de datos.
- No se cambia el precio ni la política de acceso gratuito.

## Detalles técnicos

- Trabajo confinado a `src/features/marketing` (`routes/Landing.tsx`, `routes/landingCopy.ts`, `components/sections/*`) más `index.html`, `public/sitemap.xml` y el componente `Seo`.
- Todo el texto sigue centralizado en `landingCopy.ts`; se agregan las claves `ANTES_DESPUES` y `RECORRIDO`.
- Nuevas secciones: `LandingAntesDespues.tsx` y `LandingRecorrido.tsx`; cada archivo ≤200 líneas conforme a Power of 10, sin `any` ni estilos en línea.
- Sólo tokens semánticos del sistema de diseño (`bg-primary`, `text-muted-foreground`, etc.); nada de colores fijos. Tipografía según `docs/design-system.md`.
- Datos estructurados `SoftwareApplication` vía el componente `Seo` existente; se conserva el `FAQPage` actual.
- Animaciones con clases utilitarias y `prefers-reduced-motion`; sin librerías nuevas.
- Pruebas: se extienden las de `src/features/marketing/routes/__tests__` para las secciones nuevas y el orden de secciones.
- Validación focalizada: pruebas de marketing, ESLint y `tsgo --noEmit` de los archivos tocados, más build. CI y RLS completos quedan para GitHub Actions.
- Se registra la versión en `CHANGELOG.md` y `APP_VERSION`.
- Los cambios de título/descripción sólo se verán en librecarga.com al publicar; tú publicas.
