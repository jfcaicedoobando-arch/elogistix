# Diagnóstico del "preview en blanco" y endurecimiento del arranque

## Qué encontré al probar la app real

Abrí la app en un navegador real dentro del entorno (escritorio 1280px y móvil 555px, la misma medida de tu preview) y esperé 14 segundos:

- La app **sí monta**: `div#root` termina con ~73,600 caracteres de contenido y la landing se ve completa (encabezado, hero, botones).
- **No hay recargas en bucle**: la URL y el contenido se mantienen estables a los 3, 8 y 14 segundos.
- **No hay `ReferenceError` ni `TypeError`** de mounting; el servidor de desarrollo está estable.

Conclusión: el evento `preview_dom_blank` que reportó el pixel de Bing describe el **iframe del editor**, no un crash de la aplicación. Coincide con lo que ya observaste: en pestaña nueva la app se ve; dentro del iframe no.

Analogía: la tienda está abierta y con luces prendidas; lo que falla es el cristal del aparador desde el que estabas mirando.

## Un error real que sí vale corregir

Hay un error no capturado durante el arranque:

```text
RangeError: Incorrect locale information provided
  at isRTL -> getReadingDirection -> getDefaultLocale
```

Viene de la librería de accesibilidad (react-aria) cuando el navegador no entrega un idioma válido. Hoy no rompe el render, pero:

- Ensucia la consola y llega a Sentry como ruido.
- Es exactamente el tipo de error de arranque que en un navegador con configuración regional rara **sí** puede dejar la pantalla en blanco.

## Cambios propuestos

1. **Fijar el idioma de la app**: declarar explícitamente `lang="es-MX"` y un proveedor de locale en la raíz, para que la librería nunca dependa de un idioma vacío del navegador.
2. **Red de seguridad en el arranque**: envolver el montaje raíz para que cualquier excepción durante el primer render muestre una pantalla de recuperación en español (con botón "Recargar") en lugar de dejar el DOM vacío.
3. **Prueba de humo automatizada**: test que valide que la raíz monta contenido y que no se emiten errores de locale al iniciar.
4. **Bitácora**: registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION`.

## Sobre el preview en el editor

No hay nada que corregir en el código para eso. Si vuelve a quedar en blanco: recarga fuerte el iframe o permite cookies de terceros para `lovable.app`; el contenido publicado y la pestaña nueva no se ven afectados.

## Detalles técnicos

- Archivos previstos: `index.html` (atributo `lang`), `src/main.tsx` (proveedor de locale + límite de error de arranque), un componente nuevo de pantalla de recuperación, y un test nuevo bajo `src/__tests__/`.
- Se respeta Power of 10 (archivos ≤200 líneas, sin `any`) y los tokens semánticos del design system: la pantalla de recuperación no usará colores literales.
