# Audit148: cobertura completa, candidato local de lectura

Estado: candidato A/B para revisión. No aplicado a la base remota, no publicado,
sin número de release ni cierre del hallazgo. Base fijada: main
`b552a7de7a684c81b1f45183b69c582fa8101ffb`, árbol
`7d39ca5de8246cf3a65e7cf593a63d852b15f543`. Incluye intactos el caché PR197,
el importador PR198, el pricing posterior y `.lovable/plan.md` sin implementar.

## Fuente y delta

Se obtuvo `pg_get_functiondef(public.pnl_financiero_embarque(uuid))` y su catálogo
mediante SELECT el 8 de octubre de 2026. El cuerpo efectivo coincide exactamente
con el baseline de main84 y main197. El espejo dashboard tenía el seguro legado;
se reconcilia con ese cuerpo real y este delta, sin reescribir replays aplicados.

El forward local sólo reemplaza el cuerpo de la función existente, que conserva
firma `uuid → jsonb`, PL/pgSQL, STABLE, SECURITY DEFINER, search_path public,
owner y ACL. No crea funciones, tablas, columnas, índices, FK, triggers,
políticas ni grants. No contiene DML. El baseline cambia únicamente ese cuerpo.

## Contrato exacto de lectura

- Póliza sin vínculo: prima independiente como antes.
- Póliza vinculada: nunca reintroducir prima total ni residual automáticamente.
  Factura y NC mantienen su costo observado canónico, incluso si el vínculo ya
  no permite acreditar cobertura.
- Usar el mismo `pf` de audit124/130, con idéntica selección, atribución y factor.
  Con asignaciones: base atribuida = subtotal × asignación del embarque /
  máximo(subtotal, asignación total). Sin asignaciones efectivas se conserva el
  fallback de cabecera. No se expanden repartos parciales.
- Cobertura compara base documental antes de NC y pagos. Que el neto o la deuda
  baje no modifica la cobertura ni vuelve a sumar la prima.
- Misma moneda: comparación `numeric` de base atribuida >= prima, sin tasa,
  redondeo nuevo ni tolerancia de un centavo.
- Monedas distintas: comparar las valoraciones MXN existentes de ambos importes
  usando `a_mxn`. La factura conserva `tc_para_documento`; la prima usa el TC
  congelado del embarque. Divisas conservan cuatro decimales de `a_mxn`.
  Valoración NULL, incluidos TC inválidos, impide acreditar cobertura.
- Misma moneda puede acreditar cobertura nominal sin TC de prima. Si la factura
  no puede valorarse, el P&L permanece incompleto aunque esa cobertura nominal
  sea completa.
- Cantidad NULL/0 conserva la normalización vigente a 1. Una cantidad efectiva
  negativa de una asignación considerada por el canon hace indeterminada la
  cobertura; no se corrige ni modifica la atribución global de audit124/130.
- Prima 0 también requiere factura vigente y pertenencia canónica. No vuelve
  elegible una factura ajena, cancelada o borrada.
- Póliza activa cuyo vínculo sea inconsistente conserva la relación, muestra
  costo observado provisional y produce estado_costos=incompleto/utilidad=NULL.
- Todas las causas anteriores de incompletitud se conservan. Una prima cubierta
  no elimina residuo sin asignar, exceso, NC sin base ni problemas contables FX.

## Diagnóstico aditivo

La nueva propiedad `seguros_cobertura` contiene sólo agregados:
`evaluada`, `vinculados`, `completos`, `inconsistentes`, `sin_atribucion`,
`asignacion_indeterminada`, `sin_valoracion`, `insuficientes`.

Los cuatro motivos son excluyentes por prioridad en ese orden y suman las
inconsistencias. `sin_atribucion` no revela la causa privada de ausencia de una
factura del conjunto canónico. No se devuelven nuevas identidades, candidatos,
folios ni listas para alimentar el selector. `completos` describe cobertura
documental; no sustituye `estado_costos` global.

## UI y compatibilidad

- Selector conserva el ID guardado y una etiqueta neutral cuando falta su fila,
  durante carga, error, refetch, listas limitadas y cambio de embarque.
- No adivina folio, estado ni motivo de ausencia. Sólo una selección explícita
  del usuario cambia el valor.
- Importe rotulado «Subtotal de factura». Explica cobertura completa y posibles
  otros gastos, sin afirmar que esta lista verifica cobertura atribuida.
- Sin ampliar consulta, RPC, query key, payload de escritura ni eventos.
- Servicio trata diagnóstico ausente, parcial o inconsistente como no evaluado.
  UI no confirma utilidad/margen ante respuesta antigua sin evaluación.
- Costos incompletos usan «Costo observado · provisional», conservan cantidades
  visibles y advierten sin inventar prima residual.

## Validación y límites

La evidencia local acompaña este candidato: forward sin numerar, cuerpo real y
catálogo de origen, diff, invariantes, runner y casos SQL sintéticos, pruebas
Vitest y typechecks. PostgreSQL local carga el cuerpo real y los helpers FX
existentes en un esquema mínimo. Comprueba lectura, aritmética y reconciliación,
no RLS, unicidad, validadores, catálogo de producción ni integración completa
del esquema. Las tablas auxiliares y stubs son exclusivos del fixture.

Quedan separados para revisión posterior:

1. Validador de escritura, eventos por prima/moneda y revalidación al restaurar.
2. Selector autoritativo capaz de demostrar atribución con permisos actuales.
3. Empaquetado forward definitivo con su padre, metadatos y checks de release.
4. Aplicación DB, catálogo remoto antes/después y GUI real sobre ese backend.

No se reutiliza ni modifica identidad45, ACL45, helpers45, envelope45 o lógica144.
La UI informativa y el cálculo de lectura no impiden por sí solos que el
validador vigente acepte una nueva relación monetariamente insuficiente.

## Integración local sobre main b552

El 8 de octubre de 2026 se recompuso exclusivamente este candidato A/B sobre
el árbol exacto b552. La comparación desde d919 contiene ocho rutas disjuntas:
cinco del importador, dos de pricing y el plan de Lovable. Las nueve rutas de
código, pruebas y SQL del candidato anterior conservan sus bytes; sólo este
documento actualiza procedencia y advertencia de publicación. No se integra
el candidato no monetario usado como fuente del historial Git ni propuestas
separadas para audit129/132.

Los 40 casos SQL aprobados siguen siendo evidencia heredada del candidato d919:
se verifican hashes de cuerpos, helpers, fixture y casos, y que el SQL del main
base no cambió. No se repiten ni se presentan como una nueva ejecución sobre
b552. La revalidación de integración frontend tiene evidencia separada,
incluido importador y pricing preservados.

## Despliegue coordinado pendiente

Esta UI exige el diagnóstico aditivo `seguros_cobertura`. Si se publica antes
de actualizar el backend P&L, una respuesta antigua sin ese diagnóstico se
interpreta como no evaluada: los costos se muestran incompletos y la utilidad
y el margen dejan de confirmarse. Es comportamiento deliberado de cautela,
pero implica una degradación visible durante un despliegue descoordinado.

Antes de publicar se debe aprobar y preparar el forward definitivo, aplicar
el backend por el flujo autorizado, comprobar su catálogo y respuesta, y
coordinar después la UI con verificación funcional sobre ese backend. Una
publicación aislada del frontend no acredita el cierre de audit148. Este
candidato local no aplica migraciones, no publica ni modifica la versión o
el manifiesto de releases. Validador, autoridad del selector, identidad, ACL
y triggers siguen fuera del alcance.
