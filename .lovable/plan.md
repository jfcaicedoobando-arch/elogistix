# Primera ronda de pulido visual

## Objetivo
Aplicar exactamente las 10 mejoras solicitadas, preservando flujos, permisos, datos y lógica de negocio. No se publicará, no se cambiará versión/CHANGELOG y no habrá cambios de base de datos.

## Implementación
1. Compactar la tabla de Actividades para mantener asunto, estado, fecha y acciones visibles; añadir truncado con ayuda y rótulos humanos.
2. Convertir los grupos de pestañas de Facturación en bloques indivisibles dentro de una sola navegación horizontal, con señal visual de desplazamiento cuando haga falta.
3. Ajustar el cuerpo común de KPI y los textos de Reportes/Facturación para permitir lectura completa y evitar moneda duplicada.
4. Distribuir los cinco indicadores de Operaciones en cinco columnas iguales en desktop HD, manteniendo mínimos legibles en tamaños menores.
5. Hacer neutros los KPI con cero alertas o rechazos; conservar color de alarma únicamente para valores positivos.
6. Hacer que las columnas fijas hereden visualmente el estado normal, rayado, hover y selección de su fila, con separador sutil.
7. Reordenar y compactar las barras de filtros de Compras y Tesorería, manteniendo todos los controles y usando el patrón existente para filtros secundarios.
8. Calcular la altura de la gráfica Top por cantidad de resultados, con límites para 1 y 10 filas.
9. Conectar el aviso de Costeo a una medición real y compartida del desbordamiento horizontal.
10. Usar etiquetas y badges semánticos existentes para tipos y entidades CRM sin cambiar valores guardados ni filtros.

## Detalles técnicos
- Mantener archivos bajo 200 líneas; extraer piezas pequeñas sólo cuando sea necesario.
- Reutilizar tokens, `DataTable`, `KpiCard`, tooltips y patrones de filtros existentes.
- Añadir o ajustar pruebas focales de columnas, variantes, altura y detección de overflow.
- Verificar las rutas afectadas a 1280×720 en temas claro y oscuro mediante smoke visual ligero.
- Ejecutar únicamente pruebas focales, typecheck/lint razonables y revisar el estado de compilación automática; CI/RLS completos quedan para GitHub Actions.

## Entrega
Resumen numerado, archivos modificados, validaciones realizadas, limitaciones si existieran y SHA real del commit resultante.