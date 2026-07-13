## Problema

El botón **"Estado de cuenta"** en la ficha del cliente (`ClienteDetalleHeader.tsx`) todavía llama a `generarEstadoCuentaPdf(...)`, que abre el diálogo de impresión del navegador. Ese comportamiento quedó como legacy después de crear el módulo nuevo `/clientes/:clienteId/estado-de-cuenta` (v13.298.0).

## Cambio propuesto

Reemplazar la acción del botón para que **navegue** a la nueva vista de Estado de Cuenta en lugar de generar el PDF legacy.

### Archivos a modificar

1. **`src/features/cliente/components/detalle/ClienteDetalleHeader.tsx`**
   - Quitar imports: `generarEstadoCuentaPdf`, `useToast`, `notifyError`, `getErrorMessage`.
   - Agregar `useNavigate` de `react-router-dom`.
   - Cambiar `onClick` del botón para hacer `navigate(\`/clientes/${cliente.id}/estado-de-cuenta\`)`.
   - Simplificar la interfaz `Cliente` (ya no necesita `direccion`, `ciudad`, `estado` para este componente si sólo los usaba el PDF — verificaré antes de recortar; si el padre los sigue pasando, los dejo por compatibilidad).

2. **`CHANGELOG.md`** + **`src/constants/appVersion.ts`**
   - Bump patch a `13.298.1`.
   - Entrada: "Botón 'Estado de cuenta' en ficha de cliente ahora navega al módulo nuevo en lugar de disparar el PDF legacy."

### Fuera de alcance

- No borro `src/generators/estadoCuentaPdf.ts` en este turno: la exportación PDF/Excel se conectará luego desde `ExportActions.tsx` dentro del módulo nuevo. Sólo desengancho el botón de la ficha.

## Analogía

Antes el botón era como una fotocopiadora vieja pegada a la puerta del cliente: le picabas y escupía una hoja para imprimir. Ahora lo convertimos en una puerta que te lleva al "cajero" nuevo (`/estado-de-cuenta`) con KPIs, filtros y tabla — la fotocopiadora sigue en el almacén por si luego la conectamos al botón "Exportar PDF" del módulo.