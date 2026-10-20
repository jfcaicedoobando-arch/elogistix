# Decisiones técnicas Cotizaciones
- Comercial de cotización: `cotizaciones.vendedor_id` lo elige el formulario con el mismo `VendedorSelect` de Oportunidades; `vendedor_email` lo resuelve sólo el trigger `_cotizacion_vendedor_misma_org` (exige miembro de la misma org) y las cotizaciones históricas quedan sin asignar. Why: etiqueta comercial confiable por tenant sin inferir dueños pasados.
