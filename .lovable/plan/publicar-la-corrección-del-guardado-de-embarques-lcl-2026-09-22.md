# Publicar la corrección del guardado de embarques LCL

## Qué pasó

El reporte de Valeria ("Faltan datos de contenedores") corresponde a un embarque
Marítimo **LCL** (carga consolidada, sin número de contenedor). En la versión que
está en línea (13.824.3) el guardado exigía número de contenedor incluso en LCL,
así que el embarque quedaba imposible de guardar.

Ese comportamiento ya está corregido en el código del proyecto: en LCL el
guardado no pide número de contenedor y sigue validando el formato cuando el
número sí viene capturado. La corrección tiene prueba automática en verde.

Conclusión verificada: no hace falta ningún cambio de código. Lo único pendiente
es que la corrección llegue a producción.

## Plan

1. Revisar el estado de seguridad del proyecto antes de publicar y, si hay
   hallazgos críticos, informarlos antes de continuar.
2. Publicar la versión actual (sin tocar número de versión ni changelog, y sin
   modificar datos ni permisos).
3. Confirmar la publicación e indicar que Valeria debe recargar la pantalla del
   embarque y volver a guardar.

## Detalles técnicos

- Embarque `ba95ca1f-e751-4ebb-9830-44540c9d1552`: `modo = Marítimo`,
  `tipo_servicio = LCL`, un contenedor con `numero_contenedor` vacío.
- `validarContenedoresMaritimo` (`useEditarEmbarqueWizard.helpers.ts`) ya omite
  el bloqueo cuando `tipoServicio === "LCL"` y conserva la validación ISO 6346
  para números informados.
- Prueba existente: `useEditarEmbarqueWizard.helpers.test.ts`.
- Sin migraciones, sin cambios de RLS, sin cambios de versión ni CHANGELOG.
- CI, RLS y E2E completos siguen quedando para GitHub Actions.
