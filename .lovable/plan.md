# Forzar wizard al convertir cotización en embarque

## Problema

Hoy una cotización Aceptada se puede convertir a embarque de tres formas, dos de ellas en un solo clic:

- **Botón primario "Crear embarque" / "Generar N embarques"** → crea el/los embarques directo desde la cotización, sin pasar por el wizard. Quedan campos críticos vacíos (ruta detallada, fechas reales, documentos, contenedores, instrucciones, etc.) y luego el operador tiene que volver a editar.
- **Menú ⋯ → "Abrir wizard manual"** → el camino correcto, pero escondido.
- **Menú ⋯ → "Crear borrador rápido"** → todavía más incompleto (sin conceptos).

El usuario reporta que el atajo de un clic genera embarques con demasiada información faltante.

## Decisión de producto

Eliminar los atajos de "un clic" desde el detalle de la cotización. La única vía visible para pasar de cotización a embarque será **abrir el wizard de Nuevo Embarque** con la cotización pre-vinculada (ya hidrata cliente, ruta sugerida, contenedores, conceptos de costo y venta), y obligar al operador a completar los 4 pasos antes de guardar.

### Estado "Aceptada, sin embarque vinculado"

- **Un solo botón primario:** `Crear embarque` → `navigate("/embarques/nuevo", { state: { cotizacionPrevinculadaId: cotizacionId } })`.
- Si `num_contenedores > 1`: la etiqueta se mantiene `Crear embarque` y se añade un `Badge` con el número de contenedores (`{n}`) como pista de que el wizard generará/duplicará varios. La lógica de "N embarques" se resuelve dentro del wizard (paso de contenedores), no en el detalle.
- **Sin menú ⋯, sin "borrador rápido", sin diálogo de confirmación** (`DialogGenerarEmbarques` deja de mostrarse en este flujo).

### Estado "ya hay embarque vinculado"

Sin cambios: botón `Ver embarque borrador`.

### Resto de estados (Borrador, Enviada, Rechazada, Prospecto)

Sin cambios.

## Cambios técnicos

1. **`src/features/cotizacion/components/CotizacionDetalleSecciones.tsx`** (líneas 108-136)
   - Reemplazar el bloque `flex items-center gap-1` (botón primario + `DropdownMenu`) por un único `<Button size="sm" onClick={() => navigate("/embarques/nuevo", { state: { cotizacionPrevinculadaId: cotizacionId } })}>` con etiqueta `Crear embarque` y, cuando `numContenedores > 1`, un `<Badge variant="secondary">` adyacente.
   - Quitar imports y props que dejan de usarse en este componente: `DropdownMenu*`, `MoreHorizontal`, `onAbrirGenerarEmbarques`, `onCrearBorrador`, `isCreandoBorrador`.
   - Mantener `embarqueIdVinculado`, `numContenedores`, `onAbrirConvertir`, `onCambiarEstado`.

2. **`src/features/cotizacion/components/CotizacionDetalle.tsx`** (consumidor)
   - Dejar de pasar `onAbrirGenerarEmbarques`, `onCrearBorrador`, `isCreandoBorrador` a `CotizacionDetalleSecciones`.
   - **No** renderizar más el `DialogGenerarEmbarques` ni el `BloqueoEmbarqueSinCostosDialog` asociado a este flujo (siguen viviendo en el código para usos futuros, sólo se quita la instancia montada desde el detalle).

3. **`src/features/cotizacion/hooks/useCotizacionDetalle.ts`**
   - Marcar como deprecated (comentario `@deprecated v13.38.0 — el flujo único es el wizard`) los handlers `handleGenerarEmbarques` / `handleCrearBorrador` y dejar de exponerlos en el retorno del hook. No se eliminan los servicios subyacentes para no romper otros consumidores ni tests.

4. **Sin cambios** en:
   - `useConvertirCotizacionAEmbarques`, `useCrearEmbarqueBorrador`, `convertirCotizacionAEmbarques`, `crearEmbarqueBorradorDesdeCotizacion` (siguen disponibles para edge functions / soporte).
   - `NuevoEmbarque.tsx` ni `useNuevoEmbarqueCotVinculada` (ya hidratan la cotización pre-vinculada vía `cotizacionPrevinculadaId`).
   - Wizard de cotización ni servicios de wizard.

5. **Tests**
   - Actualizar/ajustar el render de `CotizacionDetalleSecciones` (si tiene test) para reflejar el botón único.
   - Los tests de `useCotizacionConversions` (`convertir`, `crear borrador`) permanecen — sólo dejan de invocarse desde el detalle.

6. **Metadatos**
   - Bump `APP_VERSION` a `13.38.0` en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md` describiendo el cambio: "Eliminados atajos de un clic. Cotización Aceptada ahora siempre abre el wizard de Nuevo Embarque con la cotización pre-vinculada."

## Fuera de alcance

- No se cambian las RPCs ni servicios de generación de embarques.
- No se elimina el `DialogGenerarEmbarques` del codebase (sólo se desmonta del flujo de detalle).
- No se modifica el portal cliente ni cotizaciones informativas.
- No se ajusta el wizard de embarque (ya soporta multi-contenedor y conceptos heredados).

## Validación

- En `/cotizaciones/<id>` (Aceptada, cliente real, sin embarque): aparece **un solo botón** `Crear embarque` (+ badge si `num_contenedores > 1`), sin menú ⋯.
- Al pulsarlo, navega a `/embarques/nuevo` con la cotización pre-vinculada, el wizard hidrata cliente/ruta/conceptos y obliga a completar los 4 pasos.
- Estado con embarque vinculado sigue mostrando `Ver embarque borrador`.
