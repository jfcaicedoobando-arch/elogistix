# Cierre de la Oleada 1 (pulido visual) — remates pendientes

Los bloqueantes (Oleada 0) ya quedaron: purga de caché al cerrar sesión y permiso de cotización para el rol vendedor.

De la Oleada 1 ya está aplicado: tokens de contraste WCAG AA con prueba automática, copy inglés→español y typos visibles, `overflow-x-auto` en ~16 tablas, paginación oculta con una sola página, y la unificación del formato de moneda (negativos + código ISO, sin duplicar "MXN … MXN").

Quedan cuatro frentes a medias. Este plan los cierra en ese orden.

## 1. Toast de error global y pantalla /sin-acceso

- Rediseñar el toast de error: ancho mínimo cómodo, rejilla icono | contenido | acciones, un solo toast por mensaje (deduplicado) y sin acciones que no hacen nada.
- Dejar de mostrar nombres crudos de columna en los errores de validación (p. ej. `descripcion_mercancia` → "Descripción de la mercancía") mediante un catálogo de etiquetas legibles.
- Terminar la variante "no pudimos cargar tu perfil" de `/sin-acceso` con botón Reintentar, usando el indicador de error de perfil que ya se expone en el contexto de autenticación, y copy distinto cuando el usuario ya es administrador.
- Pruebas: deduplicado del toast, catálogo de etiquetas, y la función que decide la variante de `/sin-acceso`.

## 2. Fechas

- Corregir la etiqueta de mes desfasada del panel de Profit: derivar el nombre del mes de los valores numéricos año/mes, sin construir una fecha local y convertir zona horaria.
- Barrido de fechas ISO sueltas en cotizaciones, tesorería y conciliación para dejar DD/MM/YYYY en toda la UI.
- Prueba de la etiqueta de mes a partir de la clave `YYYY-MM`, más pruebas de moneda (negativos y no duplicación) que quedaron sin escribir.

## 3. Tablas, estados vacíos, gráficas y accesibilidad

- Encabezado faltante de la columna "Neto"; montos con `whitespace-nowrap` y `tabular-nums` para que no se partan en dos líneas.
- Fila de TOTALES a ancho completo y hover unificado en las tablas hechas a mano.
- Gráficas con menos de dos puntos muestran mensaje en vez de ejes vacíos; unidad "MXN" una sola vez en el eje.
- Tablas vacías: usar el estado vacío estándar y no dejar el encabezado colgando.
- Accesibilidad: `aria-label` en botones de sólo icono, descripción en diálogos de alerta, y soporte de teclado en tarjetas clicables.
- Sidebar: punto indicador cuando está colapsado y arreglo del corte a 1080 px.

## 4. Wizard de cotización

- Aclarar el denominador del contador "X de Y" del panel de progreso según el modo activo.
- Borrador fantasma: mostrar el aviso de "restaurar borrador" sólo cuando el borrador tiene contenido real, corrigiendo la lista de claves ignoradas que hoy no coincide con los nombres de campo.
- Completar asteriscos en los campos que bloquean el avance.
- Pruebas del mapeo mensaje→campo y de la visibilidad del aviso de borrador.

## Notas técnicas

- Todo es frontend/presentación; no se toca lógica de negocio ni base de datos.
- Cada frente se cierra con `tsgo --noEmit` y la suite de pruebas de los archivos tocados antes de pasar al siguiente.
- Se registra cada bloque en `CHANGELOG.md` con bump de `APP_VERSION`, respetando el límite de 200 líneas por componente y `docs/design-system.md`.
- Los majors de dinero (comisiones, guardas de facturas canceladas, idempotencia, EERR/PvsR con IVA) siguen fuera de alcance: son Oleada 2 posterior al release.
