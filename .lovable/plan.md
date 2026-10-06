# Errores de Sentry de las últimas 24 horas

Encontré 5 errores. Ninguno necesita cambios de código nuevos.

## Ya corregido en el código (solo falta cerrarlo en Sentry)
- **JAVASCRIPT-REACT-7P** — En Embarques, al cambiar el estado de una garantía salía el error "reading 'rest'". Pasó en la versión 13.824.31. El código actual (13.824.32) ya trae la corrección "preserve Supabase RPC receiver" en el servicio de garantías.
  - Acción: marcarlo como resuelto en Sentry.

## Avisos correctos (el sistema protegió los datos)
- **JAVASCRIPT-REACT-77** — Complemento de pago: el saldo calculado no coincidía con el de FacturApi y el sistema no timbró. Es el candado que evita sellar un saldo equivocado.
- **JAVASCRIPT-REACT-7Q** — Proforma: la factura 892 en moneda extranjera no tiene tipo de cambio. Hay que capturarlo en esa factura.
- **JAVASCRIPT-REACT-7N** — Compras: se intentó ligar la factura FP-000024 en EUR con un costo en MXN. Esa combinación no se permite.
- **LIFTGO-6** — Es de otro proyecto (LiftGo) y React se recuperó solo. No afecta a esta plataforma.
  - Acción: no cambiar nada. Solo informar a los usuarios qué dato deben corregir.

## Cierre
- Usar `update_issue` para marcar 7P como resuelto. Sin código, versión, changelog ni publicación.
