# Mejorar el modal "Capturar factura de proveedor"

Auditoría UI/UX del modal actual (`DialogNuevaFacturaProveedor` + sus dos columnas) y propuesta de rediseño **sólo de presentación**: no se toca lógica de cálculo, validaciones ni base de datos.

## Qué falla hoy

1. **La primera decisión no está donde empieza la vista.** El selector de origen (Captura manual / XML CFDI / PDF por IA) vive dentro de la columna izquierda, mientras que Proveedor y Folio están arriba a la derecha. El ojo salta entre columnas para entender por dónde arrancar.
2. **Todo se muestra desde el segundo cero.** Partidas, vinculación a embarque, notas y las 4 celdas de totales aparecen en ceros aunque no haya documento cargado. Ruido antes de que exista información.
3. **La banda de totales gasta alto útil.** Una celda comparte "IEPS" y "Retenciones" según el caso: el mismo lugar significa dos cosas distintas.
4. **La barra de cuadre explica demasiado dentro de una banda fija.** El texto de ayuda del estado "sobran" es un párrafo largo pegado sobre el footer; en pantallas de ~675 px de alto se come el formulario.
5. **"Guardar factura" se deshabilita sin decir por qué.** El usuario no sabe qué le falta.
6. **Alertas mezcladas con contenido.** El aviso de documento del buzón y la alerta de CFDI duplicado quedan dentro de la columna izquierda, cuando son mensajes de todo el modal.
7. **Lenguaje.** "Importe" en las partidas es unitario, y precisamente por eso la barra de cuadre tiene que explicarlo con un párrafo.

## Rediseño propuesto

### 1. Estructura en tres bandas claras
```text
┌ Header: ícono + título + chip TOTAL a la derecha ─────────────┐
├ Alertas (ancho completo): buzón / CFDI duplicado ─────────────┤
├ Origen del documento (ancho completo, 3 tarjetas) ────────────┤
├ Col. izquierda: partidas   │ Col. derecha: datos + embarque   │
├ Banda de cuadre (compacta, 1 renglón + "Ver detalle") ────────┤
└ Footer: Cancelar · Guardar factura ───────────────────────────┘
```
- El selector de origen pasa a banda de ancho completo con tres tarjetas seleccionables (Manual · XML CFDI *México* · PDF por IA *Internacional*), en vez de pestañas dentro de una columna.
- El chip **Total** se mueve al `headerAside` del shell; el desglose (Subtotal, IVA, IEPS, Retenciones) queda en un popover "Ver desglose". Recupera ~60 px de alto y elimina la celda ambigua.

### 2. Divulgación progresiva
- Mientras no haya origen elegido ni proveedor, la columna de partidas muestra un estado vacío con la instrucción ("Elige cómo vas a capturar la factura"), no una tabla en ceros.
- La vinculación a embarque permanece plegada hasta que haya proveedor seleccionado (hoy ya depende de él, pero se muestra igual).
- Notas ya está plegado: se mantiene.

### 3. Barra de cuadre más ligera
- Un solo renglón: semáforo + título + Subtotal vs. Conceptos.
- El párrafo de ayuda y la fórmula pasan a un desplegable "¿Por qué no cuadra?".
- Se añade `aria-live="polite"` para que el cambio de estado se anuncie.

### 4. El botón dice qué falta
- Junto a "Guardar factura", una lista corta de pendientes ("Falta proveedor", "Falta folio", "Falta importe"), derivada de los errores que el formulario ya calcula, y tooltip en el botón deshabilitado.

### 5. Lenguaje y detalle
- En partidas: "Importe" → **"Precio unitario"**, con una columna calculada "Total línea" de sólo lectura. Es la corrección que hace innecesario el párrafo explicativo del cuadre.
- Foco automático en el primer campo útil al abrir; `Ctrl/Cmd + Enter` guarda.
- En móvil el orden vertical queda: alertas → origen → datos de la factura → partidas → embarque.

## Detalles técnicos

- Archivos a tocar: `DialogNuevaFacturaProveedor.tsx`, `DialogNuevaFacturaProveedor.columnas.tsx`, `CargaCfdiSection.tsx` (tabs → tarjetas), `FacturaProveedorTotalesKpis.tsx` (→ chip + popover de desglose), `CuadreConceptosBar.tsx` (colapsable), `ConceptosManualesSection.tsx` / `CfdiConceptosPreview.tsx` (encabezados de columna y estado vacío).
- Nuevos componentes pequeños: `OrigenDocumentoPicker.tsx`, `PendientesGuardarHint.tsx`, `TotalesChipDesglose.tsx`.
- Se sigue usando `FormDialogShell` (`headerAside`, `stickyBottom`, `bodyClassName`); no se agregan tokens de color ni estilos inline.
- Cero cambios en hooks de cálculo (`useCuadreCaptura`, `useNuevaFacturaProveedorForm`), servicios, RPCs o migraciones.
- Se agregan pruebas de render para el nuevo selector de origen y el hint de pendientes; se actualiza `CHANGELOG.md` y `APP_VERSION`.
