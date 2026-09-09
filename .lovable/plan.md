# Pulido profesional del PDF "Estado de cuenta"

Contexto: el PDF ya migra a descarga directa (v13.823.248) y la maquetación básica
pasó QA visual. Este bloque es **puro pulido visual/presentacional** del documento
(`src/pdf/documents/EstadoCuentaDocument.tsx` + generador). No toca consultas,
datos, importes ni lógica de aging.

## Mejoras propuestas

### 1. Encabezado corporativo
- Incluir logo de la organización (si existe en configuración del emisor) al lado
  izquierdo, junto a razón social del emisor; fallback tipográfico si no hay logo.
- Tarjeta de cliente mejor jerarquizada: nombre en bold, RFC, dirección en líneas
  separadas (en lugar de un solo renglón corrido).
- Fecha de generación y periodo/corte visibles a la derecha.

### 2. Resumen ejecutivo arriba (antes de la tabla)
- Franja de KPIs por moneda: **Total pendiente** y **Total vencido** destacados,
  para que el cliente entienda su posición sin leer la tabla completa.
- Monto vencido en color de alerta cuando > 0.

### 3. Tabla de facturas
- Filas vencidas con acento visual sutil (texto de días/bucket en color de alerta).
- Fila de **Total** al final de la tabla por moneda en bold, para cerrar lectura.
- Mantener cebra, encabezado repetido en cada página y foliación (ya funcionan).

### 4. Sección de antigüedad
- Fila "Total" del aging en bold (hoy se ve como un bucket más).
- Espaciado entre bloques por moneda más aireado.

### 5. Pie profesional
- Datos de pago/contacto del emisor (banco/CLABE o correo de cobranza) si están
  configurados; texto estático corto como fallback ("Para cualquier aclaración
  sobre este estado de cuenta, contáctanos").
- Conservar Footer existente (empresa + fecha + página X de Y).

## Archivos
- `src/pdf/documents/EstadoCuentaDocument.tsx` — layout y estilos (principal).
- `src/generators/estadoCuentaPdf.tsx` — pasar logo/datos de contacto del emisor
  si el emisor ya los expone (reusar `cargarEmisorEmpresa`, sin nuevas queries
  salvo que el campo ya exista).
- `src/generators/__tests__/estadoCuentaPdf.test.ts` — ajustar regresiones si
  cambia el contrato del documento.

## Verificación
- QA visual obligatoria: render a PDF con datos sintéticos (2 monedas, todos los
  buckets, >20 filas para multipágina), `pdftoppm` e inspección página por página.
- Typecheck + ESLint focalizados + build.
- Bump `APP_VERSION` + CHANGELOG + `db:release-manifest:update` + `audit:manifest`.
- Sin CI/RLS/E2E/Vitest globales locales (van en GitHub Actions). Sin migraciones
  ni cambios de datos. No publicar.

## Fuera de alcance
- Cambios en aging, monedas, TC, consultas o qué facturas se incluyen.
- Nuevas tablas/configuraciones.
