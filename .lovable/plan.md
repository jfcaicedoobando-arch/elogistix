# Auditoría FHD (1920×1080, sidebar abierta) — Detalle de embarque

Screenshots recapturados a resolución exacta 1920×1080 (verificado con PIL). Hallazgos priorizados por severidad visual en pantalla ancha.

---

## Hallazgos observados

**Above-the-fold (pantalla 1):**
1. **Cards `Datos generales` vs `Ruta y transporte` desiguales.** `Ruta y transporte` tiene 9 filas (por los botones "Capturar ETD/ETA"); `Datos generales` tiene 7. Ambas usan `h-full`, así que la más corta queda estirada con ~150px de espacio vacío bajo "Responsable operativo".
2. **Botones `+ Capturar ETD` y `+ Capturar ETA`** aparecen dos veces seguidos en color `primary`. En FHD, dos CTAs primarios idénticos apilados generan ruido y compiten con `Avanzar a En Tránsito` del header.
3. **Stepper de 8 pasos** ocupa ~130px verticales sólo para indicar "vas en el 2/8". En FHD es demasiado espacio para info de baja frecuencia.
4. **Header:** botón `⋯` con `variant="outline"` tiene el mismo peso visual que `Editar`. Debería ser secundario.

**Scroll medio (pantalla 2):**
5. **Cards `Shipper` y `Consignatario`** — una sola línea de contenido cada una, pero cada card mide ~140px de alto. Podrían unificarse.
6. **Tabla de contenedores** — sólo 4 columnas visibles (#, Número, Tipo, Piezas). En 1500px de ancho útil los valores quedan flotando con 400+ px de gap entre columnas. La columna `#` no aporta valor con 6 filas.

---

## Plan de refinamiento

### Batch E — Balance de cards principales
**Archivo:** `src/features/embarques/components/TabResumen.tsx`, `tabResumen/ResumenCards.tsx`

- Quitar `h-full` de `DatosGeneralesCard` y `RutaTransporteCard`, o cambiar el grid contenedor a `items-start` para que cada card mida lo que necesita.
- Consolidar `Shipper` + `Consignatario` en una sola card "Partes" con grid de 2 columnas internas (mismo alto, mitad de espacio vertical).

### Batch F — ETD/ETA: un solo CTA discreto
**Archivo:** `tabResumen/ResumenCards.tsx`

- Cuando ambos ETD y ETA faltan en `Confirmado`/`En Tránsito`, colapsar en un solo banner interno arriba de la tabla de fechas:
  `⚠ ETD y ETA sin capturar — [Capturar fechas]` (botón `variant="link"` → wizard paso 3).
- Cuando falta sólo uno, mantener el botón inline pero cambiarlo a `variant="link"` (text-primary sin fondo) para bajar el peso visual y no competir con el CTA del header.

### Batch G — Stepper compacto
**Archivo:** `src/features/embarques/components/EstadoStepper.tsx` (o donde viva)

- Variante compacta para el detalle: reemplazar los 8 círculos numerados grandes por una fila horizontal más delgada (altura ~48px vs ~130px), con:
  - Chip activo grande con nombre del estado actual (`Paso 2 de 8 · Confirmado`).
  - Barra de progreso discreta debajo, con puntos pequeños para pasos previos/futuros.
- Mantiene la información pero libera ~80px verticales.

### Batch H — Header: bajar peso del `⋯`
**Archivo:** `EmbarqueDetalleHeaderActions.tsx`

- Cambiar el trigger del `DropdownMenu` de `variant="outline"` a `variant="ghost"` (solo icono, sin borde). Queda claro que es un menú secundario y `Editar` recupera su jerarquía.

### Batch I — Tabla de contenedores densa
**Archivo:** `contenedores/SeccionContenedoresReadonly.tsx`

- Eliminar la columna `#` (con 6 filas la numeración no aporta).
- Ajustar anchos: `Número` con `w-auto`, `Tipo` con `w-[120px]`, `Piezas` con `w-[120px]` alineado a la derecha, y `max-w-4xl mx-auto` en la tabla para que no se estire innecesariamente en FHD. Así las columnas quedan agrupadas con espaciado natural en vez de flotando en 1500px.

---

## Detalles técnicos

- No hay cambios de lógica de negocio; sólo layout, `variant` de botones, y visibilidad de columnas.
- `EstadoStepper` (Batch G) es el cambio con más superficie: si el componente se usa también en otras vistas (lista, edición), habría que:
  1. Confirmar dónde más se renderiza (grep de `EstadoStepper` o similar).
  2. Aceptar prop `compact?: boolean` en vez de reemplazar el diseño, para no romper otras vistas.
- El banner de Batch F reutilizará `Alert` de shadcn con `variant="default"` + icono, mismo look que otros avisos de la app.

## Verificación
- Recapturar 4 screenshots FHD tras cada batch y comparar con la línea base actual.
- Typecheck (`bunx tsgo`) tras cada batch.
- Bump `APP_VERSION` a `13.300.14` y una entrada nueva en `CHANGELOG.md` cubriendo E–I.

## Fuera de alcance
- Reagrupar los 11 tabs (Resumen, Tracking, …, Notas y Actividad) en clusters funcionales (Operativa / Financiero / Docs). Requiere decisión de producto y navegación — abrir plan separado si se aprueba.
- Cambios en tabs distintos a `Resumen` (Tracking, Documentos, Costos, etc.) — la auditoría fue sólo del tab activo (Resumen).
