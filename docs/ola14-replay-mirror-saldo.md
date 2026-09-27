# Divergencias toleradas de replay-mirror

Revisado el **2026-09-26** contra
`scripts/audit-replay-mirror-baseline.json`: **cuatro entradas**, no ocho/catorce.

| Espejo | Función |
| --- | --- |
| `auditoria/auditoria_embarques_org.sql` | `auditoria_embarques_org` |
| Mismo espejo | `_audit_embarques_umbrales` |
| Mismo espejo | `_audit_embarques_agregar` |
| `facturacion/recalcular_estado_factura.sql` | `recalcular_estado_factura` |

El JSON conserva identidad y migración vigente de cada excepción.
No copiar timestamps a esta guía: usar el inventario actual.

## Criterio de resolución

El guard `audit:replay-mirror` impide nuevas divergencias y entradas muertas.
Si espejo está atrasado/cosmético, alinear después de revisar el replay efectivo.
Si el espejo contiene la corrección necesaria, crear migración nueva posterior.
Nunca editar migración aplicada o agrandar baseline para conseguir verde.

No se promete una fecha/ola de vaciado que no esté aprobada.
Estas excepciones no se cerraron con la limpieza documental.
Al llegar a cero, revisar referencias al documento antes de retirarlo.
