# Unidad de medida en solicitudes de Pricing

## Cambio solicitado
- Agregar **Units of measurement** como lista, inmediatamente después de **Weight** y antes de **Dimensions**.
- Usar unidades de peso: **Kilogramos (kg), Libras (lb), Toneladas (t) y Gramos (g)**, sin selección predeterminada y sin hacer obligatorio el campo.
- Conservar la selección al guardar el borrador o enviar la solicitud, recuperarla al editar y mostrarla en el detalle que consulta Pricing.
- No cambiar los valores de peso, dimensiones ni solicitudes históricas; no publicar ni subir versión.

## Detalles técnicos
- Incorporar un campo opcional `unidad_medida` en la solicitud, limitado a las unidades de la lista, manteniendo los permisos existentes. Requiere una migración nueva únicamente para este campo.
- Reutilizar `CampoLista` y mantener la distribución actual del formulario.
- Validar de forma focalizada la selección, guardado, edición y visualización; las suites completas CI/RLS quedan en GitHub Actions.