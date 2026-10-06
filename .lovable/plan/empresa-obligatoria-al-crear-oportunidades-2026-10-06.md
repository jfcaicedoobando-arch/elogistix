# Empresa obligatoria al crear oportunidades

## Cambios
- Agregar **Empresa asociada \*** con búsqueda de empresas existentes al formulario de nueva oportunidad y al alta rápida.
- Mantener la selección de prospecto o cliente de origen y las validaciones actuales.
- Deshabilitar **Crear oportunidad** mientras falte la empresa e incluirla en el aviso de campos pendientes.
- Conservar la empresa seleccionada al pasar del alta rápida al formulario completo.
- Guardar la oportunidad y su asociación con la empresa como una sola operación: si falla cualquiera, no guardar ninguna.
- No exigir recapturar empresas en oportunidades históricas ni cambiar su información.

## Detalles técnicos
- Reutilizar el catálogo de empresas CRM y la relación muchos-a-muchos existente; no agregar tablas ni cambiar el modelo de vínculos.
- El alta actual guarda únicamente la oportunidad. Preparar un RPC de creación transaccional para insertar también su vínculo, validando permisos, organización y que la empresa siga activa; canalizar por él las altas manuales completa y rápida.
- No modificar las reglas de calificación del prospecto ni reemplazar los flujos automáticos de conversión de empresas y cotizaciones.
- Registrar la decisión de guardado atómico en las reglas técnicas del proyecto.

## Validación
- Pruebas focalizadas: bloqueo sin empresa, selección, conservación al ampliar el formulario, guardado con vínculo y rechazo de empresa inválida o de otra organización.
- Revisar edición histórica, permisos y avisos de error sin ejecutar suites globales.
- Para el cambio de base, verificar el esquema y regenerar la referencia correspondiente; las suites CI/RLS completas quedan en GitHub Actions.
- No publicar ni cambiar versión o historial de versiones.