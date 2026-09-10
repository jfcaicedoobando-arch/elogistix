# Correcciones de cierre y proforma en HD

## Alcance
- Renumerar consecutivamente únicamente las fases visibles del checklist de cierre, sin inventar ni mostrar reglas ausentes.
- Ajustar el detalle de proforma para que a 1280×720 el historial se apile debajo y los importes de Conceptos permanezcan legibles.
- Conservar cálculos, datos, permisos, navegación y comportamiento móvil existentes.

## Implementación
- Derivar el número mostrado de la posición del grupo renderizado, manteniendo el orden canónico de fases.
- Cambiar el breakpoint del layout financiero compartido sólo donde corresponda a proformas, evitando afectar otros documentos.
- Añadir regresiones mínimas para numeración 1, 2, 3 sin saltos y para el layout de proforma en HD.
- Incrementar el patch, registrar CHANGELOG y actualizar el manifiesto de versión.

## Validación
- Ejecutar typecheck, lint y pruebas focalizadas de los archivos modificados.
- Verificar visualmente 1280×720 y revisar el build; CI, RLS y suites globales quedan para GitHub Actions.
- No publicar.
