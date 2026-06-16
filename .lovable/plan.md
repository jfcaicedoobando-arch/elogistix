# Unificar acciones de Cotización → Embarque

## Problema

Cuando una cotización está **Aceptada** (cliente real, sin embarque vinculado), aparecen 3 botones en `CotizacionDetalleAcciones` que hacen cosas muy parecidas:

1. **"Crear embarque borrador"** → RPC `crearEmbarqueBorradorDesdeCotizacion` (1 clic, copia mínima).
2. **"Crear Embarque (wizard)"** → navega a `/embarques/nuevo` con la cotización pre-vinculada.
3. **"Generar Embarques"** → abre `DialogGenerarEmbarques`, crea **N embarques** según `num_contenedores` y copia conceptos por BL / por contenedor.

Los tres terminan en un embarque, los usuarios no saben cuál usar y la documentación interna mezcla los términos. La sesión del usuario lo confirma: entró a una cotización, vio los botones y se quedó sin hacer clic.

## Decisión de producto

Dejar **una sola acción primaria visible** y mover las variantes a un menú secundario, con copy claro que explique cuándo usar cada una.

### Caso por defecto (`num_contenedores === 1`)

- **Botón primario:** `Crear embarque` → ejecuta el flujo "Generar Embarques" actual (1 embarque, copia conceptos correctamente). Es el camino correcto y no requiere extra clics porque solo hay un contenedor.
- **Menú "Más opciones" (⋯):**
  - `Abrir wizard manual` → ruta `/embarques/nuevo` con `cotizacionPrevinculadaId` (para casos donde el operador quiere ajustar antes de guardar).
  - `Crear borrador rápido (sin conceptos)` → la RPC actual. Se queda como atajo avanzado para soporte / debugging, oculto del flujo principal.

### Caso multi-contenedor (`num_contenedores > 1`)

- **Botón primario:** `Generar N embarques` (mismo handler, mismo `AlertDialog` de confirmación que ya existe).
- **Menú "Más opciones":** mismas dos entradas que arriba.

### Estado "ya hay embarque vinculado"

Se conserva tal cual: un único botón **"Ver embarque borrador"**. No cambia.

## Cambios técnicos

1. **`src/features/cotizacion/components/CotizacionDetalleSecciones.tsx`**
   - Reemplazar el bloque de 3 `<Button>` (líneas 104-121) por:
     - Un `<Button>` primario cuyo `onClick` es `onAbrirGenerarEmbarques` (ya lanza el `AlertDialog` con candado de costos).
     - Etiqueta dinámica: `Crear embarque` si `numContenedores === 1`, `Generar {n} embarques` si es mayor.
     - Un `<DropdownMenu>` adjunto (botón ghost con `MoreHorizontal`, `aria-label="Más opciones de embarque"`) con los dos items:
       - "Abrir wizard manual" → mismo `navigate("/embarques/nuevo", ...)`.
       - "Crear borrador rápido" → `onCrearBorrador`, deshabilitado con `isCreandoBorrador`.
   - Mantener todas las props existentes para no romper el contrato con `CotizacionDetalle.tsx`.

2. **Sin cambios** en:
   - `useCotizacionDetalle` controller / handlers (`handleGenerarEmbarques`, `handleCrearBorrador`).
   - `DialogGenerarEmbarques` ni `BloqueoEmbarqueSinCostosDialog`.
   - Servicios `convertirCotizacionAEmbarques` / `crearEmbarqueBorradorDesdeCotizacion`.
   - Tests existentes en `useCotizacionConversions.test.tsx` (los 3 hooks siguen vivos).

3. **Telemetría/Bitácora:** no se añaden eventos nuevos; los handlers actuales ya registran su actividad.

4. **Metadatos:**
   - Bump `APP_VERSION` a `13.37.0` en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md` describiendo la unificación.

## Fuera de alcance

- No se elimina ninguno de los 3 servicios subyacentes (la RPC y el wizard manual siguen disponibles para casos de soporte).
- No se cambia el flujo de portal cliente, ni el de cotización informativa, ni el de cotizaciones en estado Borrador/Enviada.
- No se renombran rutas ni se reordenan secciones del detalle.

## Validación

- Verificar visualmente en `/cotizaciones/<id>` (Aceptada, cliente real, sin embarque) que aparecen 1 botón + 1 menú.
- Revisar que al pulsar el botón primario se abre `DialogGenerarEmbarques` (con candado de costos cuando aplique).
- Confirmar que los items del menú navegan / disparan la RPC correctamente.
