# Confirmación — sin cambios adicionales

Las respuestas a las preguntas abiertas ya coinciden con lo implementado en v13.47.2:

## 1. Ruta del barco (post-tarifa)
**Ya cumplido.** En `SeccionCondicionesComerciales.tsx`:
- El input `rutaTexto` está **visible** tras la tarifa.
- Al aplicar tarifa, `aplicarTarifa.ts` autollena con `"{puerto origen} → {puerto destino}"` (heredado).
- El input queda **editable** por el comercial; muestra hint *"Sugerida desde la tarifa. Puedes editarla si el agente confirma escalas."*
- Sin tarifa: deshabilitado.

## 2. Seguro (post-tarifa)
**Ya cumplido.** `SeguroBlock` se reutiliza tal cual en la nueva sección:
- Toggle Sí/No y valor de mercancía 100% manuales.
- Sin default sugerido desde tarifa/agente.
- Sin tarifa: deshabilitado.

## Acción
Ninguna. La implementación de v13.47.2 ya responde a ambas decisiones. Si quieres, puedo dejarlo así y pasar a la siguiente mejora del wizard.
