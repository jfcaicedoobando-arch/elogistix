# Siguientes olas de la auditoría (Olas 8 a 11)

Revisé los 6 archivos de hallazgos en `docs/audit-fixes/` (75 IDs) contra el CHANGELOG y el código. Confirmado ya cerrado: todo BL (01-11), FE-01 a FE-07 y FE-11, UIB-01 a UIB-14, UIA-01 a UIA-08 y UIA-11, UX-01/UX-02/UX-05, N1, TC-02.

Lo que queda se agrupa en cuatro olas por tema y riesgo. Cada ola termina con pruebas, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Ola 8 — Consistencia y salidas en pantallas internas (UIA residuales)

- **UIA-15**: la tabla de Embarques sólo dice "No se encontraron embarques"; se cambia por un estado vacío con botón "Limpiar filtros".
- **UIA-16**: no hay puerta de entrada visible para crear un embarque. Se restaura un botón "Nuevo embarque" que explica el prerrequisito (cotización aceptada) y lleva a Cotizaciones, sin tocar el guard de la ruta ni la política tarifa-first.
- **UIA-14**: la lista de cotizaciones no muestra vigencia y el detalle muestra "Vigencia 7 días (-)"; se muestra la fecha real de vencimiento o "Sin vigencia".
- **UIA-09**: descuadre del conteo de contenedores entre lista y detalle: se unifica la fuente del conteo.
- **UIA-12**: se completa el título del documento (`useDocumentTitle`) en las rutas de detalle que aún no lo usan.
- **UIA-17**: el stepper de etapas del tracking se duplica para lectores de pantalla; se marca la copia decorativa como oculta a accesibilidad.
- **UIA-10** (verificar primero): P&L con tipo de cambio "0.0000". Antes de cambiar código se revisa con datos reales si el descuadre sigue ocurriendo; si ya está cerrado, se documenta y se omite.

## Ola 9 — Validaciones financieras residuales (FE P3)

- **FE-08**: el alta de vendedora acepta 150% o −5% de comisión (la edición sí valida). Se aplica el mismo rango 0-100 en el alta y en el campo.
- **FE-12**: el total en pesos que valida el límite de crédito se acumula con flotantes crudos; se migra a los helpers centrales (`sumarSubtotales`, `calcularIVA`, `roundMoney`) para que coincida centavo a centavo con lo que se timbra.
- **FE-09**: se verifica que todos los catálogos de Configuración tengan confirmación de borrado y botón deshabilitado sin permiso; se completan los que falten.
- **FE-10**: el rol **tesorero** puede registrar cobros en base de datos pero la interfaz no le muestra el botón. Propuesta: alinear la interfaz a la base de datos (agregar tesorero a "Registrar cobro"), que ya es coherente con "Pagar a proveedor". Si prefieres mantenerlo restringido, se deja igual y sólo se documenta la decisión.

## Ola 10 — Accesibilidad y sistema de diseño (UX)

- **UX-06 / UX-07**: botones de sólo icono y switches sin nombre accesible → se agrega `aria-label` en los casos detectados.
- **UX-04**: se completa la asociación `label`↔`input` en formularios que aún no la tienen.
- **UX-08 / UX-09**: `Label` con clases extra fuera del sistema de diseño y cifras KPI sin el token `text-kpi`.
- **UX-10**: montos visibles con `.toFixed()` sin separador de miles → formateadores centrales es-MX.
- **UX-11**: spinners de botón reimplementados → prop `loading` del botón.
- **UX-13**: rejillas fijas de 2+ columnas sin punto de quiebre → responsivas en móvil.
- **UX-03**: 36+ tablas crudas fuera de `DataTable`/`DetailTable`. Por volumen se migran por lotes empezando por las pantallas más usadas; el resto queda listado como deuda en la documentación.

## Ola 11 — Deuda técnica y documentación

- **TC-01**: el README pide Node 20 pero las pruebas requieren Node 22; se corrige el README y se declara la versión en `package.json`.
- **TC-03**: directivas `"use memo"` que el bundler ignora en 5 rutas → se retiran o se sustituyen por memoización real.
- **TC-04**: se documenta el aviso de tamaño del chunk de PDF como falso positivo conocido.
- **UX-12 / UX-14**: se deduplican componentes repetidos entre CxP y Facturación y se quitan los colores en hexadecimal de la vista interna de logo.
- **N2**: se documenta que la pérdida de permisos del entorno local de auditoría es un artefacto del entorno, no un defecto del producto.

## Notas técnicas

- Sin cambios de contratos ni de base de datos, salvo lo que se declare explícitamente; las olas 8 y 9 tocan sólo frontend y matriz de permisos.
- Cada ola corre `bunx vitest run` sobre las áreas afectadas y typecheck; los archivos que crucen 200 líneas se dividen conforme a las reglas del proyecto.
- Se respeta el orden 8 → 9 → 10 → 11 para poder validar en preview entre olas.
