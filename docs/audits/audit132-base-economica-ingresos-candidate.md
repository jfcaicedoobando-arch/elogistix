# Hallazgo 132: ingresos económicos y notas de crédito

Candidato local de lectura sobre el árbol 129+148
`d449b0c52aae44f385b04bea572d0a4de18d095d`.
No es una migración ni una declaración de cierre en producción.

## Contrato de cálculo

- Una NC activa (`Timbrada` o `Aplicada`, no borrada) resta su base económica:
  `sum(round(cantidad * precio_unitario, 2))`. No resta el importe bruto,
  IVA ni retenciones. El descuento ya está incorporado en el precio persistido.
- El parser y la prevalidación de conversión son los fragmentos 132 revisados.
  Una línea inválida invalida toda la base de la nota; cero válido no es NULL.
- La base se convierte a moneda de factura antes del factor proporcional
  existente. Se valida también la valoración posterior de factura a MXN.
- Cast, producto, redondeo, suma, factor, conversión y utilidad se protegen
  mediante bloques locales del lector. No hay un helper ni RPC nuevo.
- La venta conocida es provisional cuando falta una base o valoración. No se
  pierde esa condición al sumar las partes conocidas. Si desborda el agregado,
  `venta.real_mxn` es NULL. Los detalles desconocidos conservan NULL.
- `utilidad_mxn` y `margen_real_pct` son NULL si ingresos o costos están
  incompletos. El margen también es NULL con venta neta cero.
- El reparto de NC en una factura multiembarque conserva su proporción actual.
  Se cuenta como provisional y no se presenta como linaje exacto del hallazgo 144.

## Diagnóstico aditivo

`estado_ingresos` y `ingresos_documentacion` transportan la incompletitud hasta
el servicio y la UI. El segundo contiene `evaluada`, `facturas`,
`notas_credito_activas`, `notas_credito_sin_base`,
`notas_credito_sin_valoracion`, `facturas_sin_valoracion`,
`repartos_provisionales` y `desbordamientos`.

Los contadores de NC sin base y sin valoración son disjuntos. Los repartos
cuentan facturas con NC activa y más de un embarque etiquetado. Los
desbordamientos cuentan operaciones, por lo que no están limitados por el
número de documentos. La actividad se establece con los conteos de documentos,
incluso si una NC lleva la venta neta a cero.

No se reutiliza `notas_credito_sin_base`, que conserva su significado de NC de
proveedor. Los diagnósticos de documentación de costos 129 y cobertura de
seguros 148 siguen independientes y se combinan al determinar la utilidad.

## Invariantes

Se conservan byte a byte 15 CTE de presupuesto, costos, asignaciones,
notas de proveedor, coberturas y documentación, incluidas todas las causas
previas de costos incompletos. La ruta de ingresos anterior se reemplaza por
cálculo local protegido. Su membresía, factor, moneda y detalle conservan el
criterio anterior, salvo las correcciones económicas y de incompletitud
explicadas arriba. El orden visual de ingresos usa importes por separado,
sin sumarlos exclusivamente para ordenar y arriesgar un desbordamiento.

No cambian tablas, writers, triggers, RLS, identidad 45, linaje 144, funciones
de saldos fiscales, XML/PDF, firma, atributos ni ACL del lector. La baseline
cambia exclusivamente el cuerpo de ese lector; conserva su envoltura original.
Se mantienen las cuatro entradas de invalidación de caché del candidato 129.

## Validación local SQL

- Dos controles RED ejecutan el lector 129 real: resta 87 bruto en Aplicada
  y omite la NC Timbrada, en lugar de restar la base 75.
- 86 escenarios contra el lector compuesto real, incluidas 53 entradas del
  parser revisado, ambos estados, datos inválidos, cero, FX en dos pasos,
  reparto 40/60 y overflow fuera del parser.
- Reejecución de los 39 escenarios 129 y los 40 escenarios 148 originales.
- Reejecución de los 137 casos originales de fragmentos con rol ordinario.
- Snapshots exactos antes/después en los 39+86 casos instrumentados.
- Catálogo `pg_proc` idéntico excepto `prosrc`, incluida firma, owner y ACL.
- PostgreSQL desechable en 127.0.0.1:55494, lock pesado compartido y shutdown.

El fixture NC2 con venta 150, base de NC 75, IVA 12 y costo documentado 100
produce venta 75, costo 100, utilidad -25. Con costo presupuestado 20.44 sin
factura de proveedor, la utilidad permanece NULL.

## Límites

Son fixtures sintéticos de esquema mínimo. No se ejecuta el esquema completo,
RLS end-to-end, browser E2E, base remota ni operaciones fiscales. No se publica
Git remoto, versión, manifiesto, migración de release ni deploy. El resumen
externo de evidencia local registra por separado la validación TS/UI/caché.
