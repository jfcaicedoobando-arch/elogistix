## Objetivo
Mostrar un banner informativo en la pantalla de detalle de embarque cuando el estado sea **Borrador**, indicando que proviene de una cotización aceptada y que debe completarse antes de avanzar estado.

## Cambio propuesto

### Frontend
- En `src/pages/embarques/EmbarqueDetalle.tsx`, justo debajo del `<EmbarqueDetalleHeader>`, agregar un componente `<Alert variant="warning">` condicional que se muestre solo cuando `estadoVisual === 'Borrador'`.
- El banner incluirá:
  - Título: "Embarque en borrador"
  - Descripción: "Este embarque fue generado desde la cotización. Complétalo y cambia su estado a Confirmado para continuar con la operación."
- Se utilizará el componente `<Alert>` existente de `src/components/ui/alert.tsx` (variante `warning`).
- No se requieren cambios en backend, hooks, ni servicios adicionales.

## Alcance
- Únicamente UI: un banner condicional en la pantalla de detalle.
- No afecta flujos de negocio ni estados de embarque.
