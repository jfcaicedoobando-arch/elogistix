# Divergencias toleradas de replay-mirror

Revisado el **2026-10-06** contra
`scripts/audit-replay-mirror-baseline.json`: **dos entradas exactas**.

| Espejo | Función |
| --- | --- |
| `auditoria/auditoria_embarques_org.sql` | `auditoria_embarques_org` |
| Mismo espejo | `_audit_embarques_agregar` |

El JSON conserva firma completa, migración efectiva vigente y SHA-256 de ambos cuerpos normalizados, además de justificación, responsable y condición de retirada. Una variación adicional invalida la excepción.

`_audit_embarques_umbrales` y `recalcular_estado_factura` coinciden al normalizar comentarios/espacios/delimitadores externos respetando literales; se retiraron sin editar SQL.
No copiar timestamps a esta guía: usar el inventario actual.

## Criterio de resolución

El guard `audit:replay-mirror` impide nuevas divergencias y entradas muertas.
Si espejo está atrasado/cosmético, alinear después de revisar el replay efectivo.
Si el espejo contiene la corrección necesaria, crear migración nueva posterior.
Nunca editar migración aplicada o agrandar baseline para conseguir verde.

No se promete una fecha/ola de vaciado que no esté aprobada.
Las dos divergencias semánticas restantes no se cerraron con este guard.
El análisis estático no sustituye replay, permisos ni invariantes en Postgres efímero.
Al llegar a cero, revisar referencias al documento antes de retirarlo.
