# Auditoría de diseño — Detalle de Cliente

Revisión visual en la pantalla real (1366×768) de `/clientes/:id`, pestañas Información, Embarques, Cotizaciones, CRM y Portal.

## Hallazgos

**1. Los KPIs se cortan (lo más visible)**
Los 6 indicadores en una sola fila dejan ~130 px por tarjeta: las etiquetas se ven "Embarq…", "Cotizac…", "Contac…", "Factura…", "Pendie…" y los importes se leen literalmente "U…". Tres de seis tarjetas no comunican ningún número.

**2. La cifra de Contactos no coincide**
El KPI muestra "Contactos 0" aunque la tarjeta de contacto sí trae datos; el número sólo cuenta contactos secundarios y confunde.

**3. El nombre del cliente se muestra en mayúsculas crudas**
"BUENO ALIMENTOS" tal como viene de la base, mientras el resto de la app usa capitalización tipo título.

**4. Tarjeta "Información General" pobre**
Son párrafos planos: el email no es un enlace, el teléfono vacío deja "Tel:" colgando, no hay copiar-al-portapapeles ni separación clara entre domicilio y contacto.

**5. Las pestañas no tienen encabezado ni acciones**
Embarques y Cotizaciones muestran la tabla suelta, sin título, sin resumen y sin botón para crear ni para ver el listado completo filtrado por este cliente. Tampoco hay buscador cuando el cliente tiene muchos registros.

**6. Estado vacío sin salida**
"Sin embarques registrados" es sólo texto; no ofrece la acción siguiente.

**7. Jerarquía de la pestaña Información**
Tres tarjetas al mismo peso apiladas a todo lo ancho; en 1366 px se desperdicia el costado derecho y hay que hacer scroll para llegar a Crédito y Contactos.

## Cambios propuestos

1. **KPIs**: bajar a 4 tarjetas visibles en fila (Embarques, Cotizaciones, Facturado, Pendiente) y mover Contactos/Profit a una segunda línea o al contexto donde pertenecen; etiquetas cortas ("Facturado", "Por cobrar") y valor con auto-ajuste de tamaño para que nunca se trunque. Tooltip con el importe completo (ya existe) se conserva.
2. **Contactos**: contar también el contacto principal del cliente, o renombrar el KPI a "Contactos adicionales".
3. **Título**: aplicar la capitalización estándar de la app al nombre y dejar el RFC como chip monoespaciado en el subtítulo.
4. **Información General**: rejilla de dos columnas con etiquetas pequeñas arriba y valor abajo, email como `mailto:`, teléfono como `tel:`, botón de copiar en RFC/email, y campos vacíos mostrados como "—" en lugar de etiqueta huérfana.
5. **Layout de Información**: dos columnas en pantallas ≥1280 px — izquierda Información General + Condiciones de crédito, derecha Contactos — para eliminar el scroll.
6. **Pestañas Embarques/Cotizaciones**: encabezado con título, contador y acciones ("Nuevo embarque" / "Nueva cotización" según permisos, y "Ver todos" que abre el listado filtrado por cliente).
7. **Estados vacíos**: usar el componente de estado vacío con icono + acción primaria.

## Notas técnicas

- Archivos afectados: `ClienteSummaryCards.tsx`, `ClienteDetalleHeader.tsx`, `ClienteInformacionCard.tsx`, `ClienteDetalleTabs.tsx`, `ClienteDetalle.tsx` (conteo de contactos).
- Sin cambios de base de datos ni de lógica de negocio; todo es presentación. El conteo de contactos es un ajuste de etiqueta/suma en el componente.
- Se reutilizan `KpiCard`, `DetailHeader`, `EmptyStateInline` y los tokens semánticos existentes — sin colores nuevos ni hardcodeados.
- Respetar Power of 10: los nuevos bloques de pestaña salen a subcomponentes en `_sections/` para mantener archivos <200 líneas.
- Actualizar `CHANGELOG.md` y `APP_VERSION` (13.370.0) al implementar.
