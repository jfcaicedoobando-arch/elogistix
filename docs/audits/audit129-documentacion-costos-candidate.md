# Audit129: documentación de costos operativos en P&L

Candidato local incremental sobre audit148 A/B (árbol
`d5850711adc104d35e1900f436d70e7e9ff19c76`), recompuesto sobre main
`b552a7de7a684c81b1f45183b69c582fa8101ffb`. No es una release, migración
aplicada ni despliegue.

## Regla y diagnóstico

Cada concepto operativo activo del embarque, de su organización y distinto
de `ajuste_factura_proveedor`, necesita al menos una asignación explícita
por `concepto_costo_id` a una factura reconocida por el canon vigente de
P&L. La asignación debe tener monto unitario positivo e importe efectivo
positivo (`monto * coalesce(nullif(cantidad,0),1)`). Cantidades NULL/0
conservan la interpretación legado de una unidad. Valores negativos no
acreditan documentación, tampoco dos valores negativos cuyo producto sea
positivo.

Se verifica presencia documental, no igualdad con el presupuesto. Una
asignación de 60 a una factura de 60 puede documentar un concepto
presupuestado en 100. Una prima independiente, una factura de cabecera,
otro concepto del mismo proveedor o una coincidencia de texto/importe no
suplen el vínculo explícito. Costos de presupuesto cero o negativos no
obtienen una exención implícita. Los ajustes de presupuesto quedan fuera.

El agregado `costos_documentacion` contiene `evaluada`, `conceptos`,
`documentados` y `sin_documentar`. Si faltan conceptos por documentar,
`estado_costos` es incompleto y `utilidad_mxn` permanece NULL. El agregado
no publica identidades nuevas. La póliza sola sin conceptos operativos
conserva el contrato legado.

## Preservación

Se añade una causa de incompletitud. No se altera el reparto 124/130, su
tratamiento de cantidades históricas, el costo, la deuda, las notas de
crédito ni la cobertura148. Una factura pagada o totalmente acreditada
puede seguir documentando el concepto. Otras causas de incompletitud
siguen vigentes aunque toda la documentación operativa esté presente.

Los CTE contables y de cobertura148 se preservan byte a byte. El nuevo
CTE consulta conceptos y asignaciones, y reutiliza la pertenencia de `pf`.
No cambia vínculos, importes guardados, writers148, identidad45/144,
triggers, firma, propietario ni ACL. No se incorpora la propuesta132.

## Invalidación de las cuatro entradas de demoras revisadas

Se invalida únicamente la clave exacta de P&L del embarque afectado al
terminar el recálculo manual, la eliminación automática, la edición de
fechas/días del contenedor y el avance manual a Entregado. Estas entradas
pueden materializar o quitar conceptos operativos, por lo que conservar
un P&L confirmado en caché treinta segundos sería incorrecto.

El identificador se conserva al iniciar la mutación, incluso si el usuario
navega a otro embarque mientras espera. La reconsulta sucede también tras
rechazo: una operación parcial, una bitácora posterior o el transporte
pueden fallar después de materializar costos. Se preservan el error visible,
los drafts y las invalidaciones previas. El P&L activo se actualiza antes
de resolver la mutación. No cambia la lógica de moneda147, los servicios,
los triggers ni el avance de estado. Esta cobertura enumera cuatro entradas
verificadas; no afirma exhaustividad de todas las mutaciones del producto.

## UI y secuencia de publicación pendiente

La UI conserva las señales129 y148 simultáneamente: costo observado
provisional, utilidad/margen no calculables y explicación documental.
Un agregado ausente, inválido o incoherente no confirma la evaluación.
No se presenta utilidad definitiva con un backend anterior.

Una eventual publicación debe coordinar primero el backend autorizado y
verificado y después la UI. Publicar sólo frontend contra un backend sin
`costos_documentacion` mantendrá el P&L provisional. Este candidato no
contiene empaquetado de release, cambio de versión ni nueva migración.

## Evidencia local

La carpeta de validación `profit129-local-20261008` contiene el control RED
contra el cuerpo148, ejecución GREEN del candidato, escenarios129 y los
40 escenarios148 originales, snapshots de todas las tablas sintéticas,
catálogo de función antes/después y checks de UI/caché, tipos y lint.
Los scripts usan un PostgreSQL desechable exclusivamente en loopback y
el lock compartido de validación pesada. Son pruebas focales con esquema
mínimo; no acreditan la suite completa, RLS, writers ni despliegue.

Origen del hallazgo: `audit/librecarga-gui-bloque15.md`, líneas163–180,
venta150 y presupuesto100 sin factura de proveedor. La regresión adicional
es la prima1 que antes podía ocultar el concepto sin documentar.
