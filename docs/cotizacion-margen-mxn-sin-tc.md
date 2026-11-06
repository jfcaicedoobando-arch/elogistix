# Margen de cotización homogénea MXN sin tipo de cambio

## Defecto y corrección

Después de corregir los permisos del trigger, QA detectó un caso independiente: venta de 150 MXN y costo de 100 MXN devolvían NULL cuando tipo_cambio_usd era NULL. La migración 0031 convertía toda partida MXN a USD, incluso cuando el ratio se podía calcular directamente en MXN.

0039 calcula directamente el margen sobre sumas MXN cuando no hay importes efectivos en otra moneda. No inventa un tipo de cambio ni actualiza cotizaciones, autorizaciones o datos históricos. Sólo reemplaza el cuerpo de la función existente conservando owner, ACL, STABLE/SECURITY DEFINER y search_path seguro de 0037. authenticated/anon no reciben EXECUTE; el grant preexistente de service_role, si existe, se conserva.

Una partida efectiva tiene importe distinto de 0. Cantidades, precios o costos NULL conservan coalesce a 0; partidas de costo borradas no cuentan. Las partidas de importe 0 no introducen necesidad de conversión, aunque tengan otra moneda. Venta total 0 o negativa sigue devolviendo NULL. Sólo se redondea el porcentaje final a 2 decimales usando numeric.

Primero se clasifican las monedas efectivas, sin sumar ni convertir. Después se calcula únicamente en la rama correspondiente: la homogénea no divide por TC; la mixta no suma subtotales monetarios crudos que podrían desbordarse aunque la conversión por partida sí cupiera. Se prueban ambos extremos numéricos.

Para monedas mixtas efectivas, un TC NULL o 0 sigue devolviendo NULL. Con TC disponible se mantienen divisiones por partida y orden histórico, sin redondeo monetario intermedio. USD puro no requiere TC. Moneda de venta ausente sigue siendo USD; otros códigos/no MXN mantienen la interpretación histórica, sin introducir soporte nuevo para divisas. No se redefine la validación de tasas negativas ni valores numeric no finitos: la rama homogénea no utiliza TC, la rama mixta conserva aritmética previa.

## Validación

- Fixture efímero local scripts/tests/cotizacion-mxn-margin.sh reproduce NULL antes de 0039 y cubre 24 casos monetarios más 500 casos mixtos diferenciales contra el helper histórico.
- Comprueba conservación de owner/ACL/search_path/security flags y denegación directa a authenticated.
- Guard oficial cotizacion_margen_mxn_sin_tc.sql verifica envío autenticado de 150/100 MXN sin TC → 33.33, handover, aceptación y embarque Borrador con auth/org_scope/RLS reales; rollback de todos los datos sintéticos.
- No se ejecuta ninguna prueba de esta suite sobre la base real.

La publicación del código no aplica la migración ni despliega. La aplicación a una base requiere evaluación y autorización separadas.
