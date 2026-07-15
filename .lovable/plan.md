## Respuesta corta

**Estás parcialmente en lo correcto**, pero hay una condición que se te está escapando: el SAT sí exige aceptación del receptor aunque la cancelación sea por sustitución (motivo 01), **salvo que canceles el mismo día de emisión**.

## La regla real (RMF 2.7.1.34/35, vigente 2022+)

Un CFDI se puede cancelar **sin aceptación del receptor** SOLO si cae en alguno de estos supuestos:


| Supuesto                                          | ¿Aplica a F971?                     |
| ------------------------------------------------- | ----------------------------------- |
| Monto ≤ $1,000 MXN                                | ❌ ($4,760)                          |
| RFC genérico (XAXX010101000 / público en general) | ❌ (cliente con RFC)                 |
| Nómina, egresos, traslado, ingresos a extranjeros | ❌ (es CFDI ingreso normal)          |
| **Cancelado el mismo día de emisión**             | ❌ (emitida 10-jul, cancelas 15-jul) |
| Sector primario, retenciones, RIF, etc.           | ❌                                   |


Como F971 no cae en ninguno, **requiere aceptación** aunque emitas la sustituta con relación 04.

**Analogía:** La sustitución (motivo 01) es como decirle al SAT "esta factura vieja se reemplaza por esta nueva". Es correcto y necesario para no duplicar ingresos ante Hacienda, pero **no salta el trámite de aceptación** del cliente. Son dos cosas independientes: relacionar (obligatorio ante SAT) y cancelar (requiere aceptación del receptor).

## Confusión común

Antes de la reforma 2022, la sustitución sí eximía de aceptación. Ese cambio pegó fuerte porque mucha gente aún opera con la regla vieja. Hoy el único atajo real es **cancelar el mismo día**.

## Opciones que puedo implementar (si quieres)

1. **Alerta preventiva en el modal de cancelación**: antes de intentar cancelar, mostrar un banner con las condiciones de aceptación cuando aplique (monto > $1,000, no mismo día, RFC no genérico). Evita el ida-y-vuelta al SAT.
2. **Botón "Cancelar mismo día"** destacado cuando `fecha_emision = hoy`: para aprovechar la ventana sin aceptación.
3. **Dejarlo como está** ahora que el mensaje de error (v13.300.58) ya explica claramente qué hacer.

¿Quieres que implemente 1, 2, ambos, o lo dejamos con solo el mensaje mejorado? 1 y 2