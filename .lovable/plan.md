# Pulir tarjeta "Facturas de proveedor recibidas" (dirección elegida: Columnas densas)

## Objetivo
Reordenar visualmente el buzón de facturas del tab Costos del embarque: hoy cada renglón apila 4-6 líneas de texto y los botones flotan a media altura. Pasamos a una lista tipo tabla con columnas alineadas, sin tocar ninguna funcionalidad.

## Alcance (sólo UI)
Sin cambios en base de datos, RPCs, permisos, estados, cálculos de montos ni textos de negocio. Sólo re-acomodo de los mismos datos y acciones que ya existen.

## Cambios

### 1. Renglón en columnas (`FacturaEntranteItem.tsx`, `MetaEntrante.tsx`)
Cada documento pasa de columna vertical a una rejilla de 4 columnas en escritorio (se apila en móvil):

```text
| [icono] archivo.pdf      | Proveedor          | Total con IVA      | [acciones]  |
| Rechazada · PDF · XML    | Folio: X · Fecha   | Conceptos: ...     |             |
| ▍nota de rechazo (franja roja, ancho completo debajo)                              |
```

- **Col 1 — Archivo y estado:** ícono de documento (rojo si rechazada), nombre de archivo truncado, badges de estado + PDF/XML/Falta XML, chip de folio interno (enlace a la factura, se conserva).
- **Col 2 — Proveedor y folio:** nombre del proveedor, folio del proveedor y fecha de subida con días en espera.
- **Col 3 — Montos:** subtotal sin IVA y total con IVA detectados del CFDI, monto declarado por operaciones y conteo de conceptos sugeridos.
- **Col 4 — Acciones:** los mismos botones (Ver PDF, XML/Adjuntar XML, Corregir datos, Devolver a por capturar, eliminar), compactos y alineados a la derecha, siempre visibles (no convertimos a iconos sin texto para no perder claridad).
- **Nota de rechazo:** franja roja suave a todo el ancho, debajo del renglón, en vez de texto suelto.
- Barra de color a la izquierda del renglón según estado (roja si rechazada).
- La nota simple y el aviso "sin costo capturado" se mantienen como línea discreta.

### 2. Encabezado de columnas
Una fila de encabezados ("Archivo y estado", "Proveedor y folio", "Montos", "Acciones") visible sólo en escritorio cuando hay documentos, para alinear la lectura.

### 3. Encabezado de la tarjeta (`EntrantesCardHeader.tsx`)
Sin cambios de fondo: mismo título, descripción, badges de resumen y botón Subir factura. A lo sumo ajuste menor de espaciado para alinear con la nueva lista.

## Validación
- Typecheck + ESLint focalizado + pruebas de los componentes tocados.
- Captura de pantalla con Playwright del tab Costos para confirmar el acomodo.
- Bump `APP_VERSION` + entrada en `CHANGELOG.md` + `audit:manifest`.
- CI/RLS/E2E completos quedan para GitHub Actions.
