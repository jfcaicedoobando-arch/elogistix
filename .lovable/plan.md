# Plan: lote visual P2

## Resultado
Corregir exclusivamente los seis problemas visuales reportados, conservando cálculos, importes, reglas fiscales, permisos y datos.

## Cambios
1. Mostrar en cada concepto USD/MXN una etiqueta fiscal discreta usando el mapeo existente; los datos incompletos dirán “Por confirmar”. Mantener intactos los cálculos y hacer coherente el pie.
2. Permitir dos líneas en Origen y Destino sin modificar el grid; Destino tendrá prioridad visual y ambos conservarán el texto completo en tooltip.
3. Renombrar el resumen de Facturación para indicar que cuenta conceptos vinculados, no documentos; aclarar el estado facturado sin cambiar conteos ni agrupación.
4. Distribuir nombre y badge de prospecto para que el nombre use hasta dos líneas y las acciones sigan visibles a 1280 px.
5. Mejorar el contraste semántico del selector fiscal y sus opciones en temas claro/oscuro, incluida la opción activa y el 8% deshabilitado, sin alterar restricciones.
6. Mantener el modo compacto de Costos hasta antes de 2xl; alinear encabezado, filas y totales y conservar acceso visible a margen y acciones.

## Validación dirigida
- Ajustar o agregar sólo pruebas cercanas de los seis componentes.
- Ejecutar esas pruebas focalizadas, typecheck y ESLint únicamente sobre archivos tocados.
- Revisar visualmente las vistas afectadas a 1280×720 y 1440×900; si los registros privados no son accesibles, usar estados de prueba equivalentes y reportarlo.
- No ejecutar CI, RLS ni E2E completos. No publicar ni modificar versión o CHANGELOG.
