# Pulido P2 de P&L y contenedores

## Objetivo
Corregir cinco señales visuales confusas en Cotizaciones/Embarques sin cambiar cálculos, datos, reglas de negocio ni backend.

## Cambios
1. Mostrar el selector **Global / Por contenedor** únicamente cuando exista al menos un contenedor operativo registrado; si deja de aplicar, conservar la vista Global.
2. En el resumen de contenedores, tratar filas sin número como marcadores: mostrar sus peso, volumen y piezas como **Sin capturar / —**, excluirlas del resumen uniforme y conservar los ceros de contenedores válidos.
3. Identificar permanentemente la P&L por contenedor como **Presupuesto** y aclarar que proviene de conceptos cotizados.
4. Presentar **Generales** como una fila auxiliar de origen del prorrateo, con la leyenda **Ya incluido en los contenedores · no se suma al total**, sin cambiar sus importes ni la fila Total.
5. Mostrar la nota de tipo de cambio sólo cuando existan conceptos activos no-MXN y listar únicamente las monedas presentes; el comparativo DOF se mostrará sólo cuando USD esté presente.

## Pruebas focalizadas
- Condición del selector por existencia de contenedores operativos.
- Formato de marcadores y conservación de cero en contenedores válidos.
- Etiquetas de presupuesto y fila auxiliar de Generales.
- Nota T/C ausente para MXN-only, USD sin EUR sobrante y compatibilidad con EUR.
- Ejecutar únicamente pruebas relacionadas, revisión de tipos/lint focalizada y auditorías de versión/manifest; no CI/RLS/E2E completos.

## Entrega
Actualizar `APP_VERSION` a **13.823.373**, agregar su entrada al `CHANGELOG.md` y regenerar el manifest conservando entradas previas. No publicar.

## Detalles técnicos
- Reutilizar los conceptos y contenedores ya disponibles en caché para evitar lecturas duplicadas.
- Extraer helpers puros pequeños donde permitan probar condiciones de render sin exceder 200 líneas.
- No modificar RPCs, migraciones, RLS, fórmulas financieras ni registros existentes.
