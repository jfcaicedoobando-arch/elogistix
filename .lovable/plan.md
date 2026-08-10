# Auditoría visual y rediseño del modal "Cobro en lote de cliente" (1280 × 720)

Capturé el modal en 1280 × 720 con 3 facturas de INDIMEX TRADING. Encontré un defecto de maquetación real (texto encima de la tabla) y varios problemas de aprovechamiento del espacio.

## Lo que se ve mal hoy

1. **Los totales se dibujan encima de la tabla.** "Repartido: …" y "Sin asignar: …" quedan traslapados sobre los renglones de facturas. Causa: la sección "Reparto entre facturas" usa el grid de 2 columnas por defecto, así que la tabla cae en la columna izquierda y el resumen en la derecha, y la tabla se desborda sobre él. Lo mismo le pasa a "Notas": el cuadro de texto solo ocupa la mitad del ancho.
2. **El modal es muy angosto** (576 px). Una tabla de 5 columnas (Factura, Vence, Saldo, Se aplica, Queda) no cabe: los importes se aprietan y los campos de captura quedan de 128 px.
3. **Media pantalla desperdiciada.** Fecha e Importe ocupan la izquierda y la derecha queda vacía; las etiquetas se parten en dos líneas ("Importe recibido (USD)", "Cuenta bancaria (opcional)").
4. **Mucho scroll.** El contenido mide 827 px en un área visible de 548 px: el usuario no ve al mismo tiempo el importe capturado y el reparto, que es justo lo que necesita comparar.
5. **El aviso de saldo y TC DOF se corta en 4 líneas** debajo del importe.

## Qué voy a cambiar (solo presentación)

- **Ancho a `3xl`** para que la tabla de reparto respire en 1280 px.
- **Sección de reparto y Notas en `flat`** (una sola columna a todo el ancho): desaparece el traslape y la tabla usa el ancho completo.
- **Datos del depósito en 3 columnas** en desktop (Fecha · Importe recibido · Forma de pago), con Cuenta bancaria y Referencia en la segunda fila. Etiquetas más cortas: "Importe recibido", "Cuenta bancaria", "Forma de pago" (la moneda y el "opcional" pasan a texto de ayuda).
- **Resumen vivo fijo**: "Repartido / Sin asignar / Facturas que quedan liquidadas" se mueven a la banda `stickyBottom` del shell, siempre visibles sobre el footer, con el mensaje de error en la misma banda. Además, chip de saldo total en `headerAside`.
- **Tabla de reparto más legible**: contenedor con scroll horizontal propio, encabezados alineados (texto a la izquierda, importes a la derecha), campo de captura de 40 px de alto y ancho cómodo, renglón resaltado cuando queda liquidado ("Liquidada") o parcial, y el saldo/TC DOF en una sola línea de ayuda.
- **Densidad para pantallas de 720 px**: espaciado del cuerpo reducido para que el importe y los primeros renglones queden visibles sin scroll.

## Detalles técnicos

- Archivos: `DialogCobroLoteCliente.tsx` (size `3xl`, `stickyBottom`, secciones `flat`), `DialogCobroLoteDatos.tsx` (grid `md:grid-cols-3`, etiquetas y textos de ayuda), `DialogCobroLoteRenglones.tsx` (wrapper `overflow-x-auto`, anchos por columna, badge de estado por renglón).
- Sin cambios de lógica: no se toca `usePagoClienteLoteState`, `pagoClienteLote.ts` ni la RPC. El reparto FIFO, validaciones y REP siguen igual.
- Solo tokens semánticos (`text-muted-foreground`, `text-warning`, `text-destructive`, `bg-muted/50`); nada de colores fijos ni `style={{}}`.
- Nuevo componente pequeño `DialogCobroLoteResumen.tsx` para la banda de totales, manteniendo cada archivo bajo 200 líneas.
- Verificación: recaptura en 1280 × 720 con Playwright (modal abierto, scroll arriba y abajo) y revisión de que no haya traslapes; `bunx vitest run` de las pruebas del diálogo.
- Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
