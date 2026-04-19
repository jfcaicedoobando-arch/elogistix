
El usuario pide implementar el flujo "Crear embarque desde cotización" con:
1. Botón en `CotizacionDetalle` que abra el wizard de embarques pre-llenado.
2. Pre-rellenar: cliente, ruta, mercancía y conceptos (venta y costo).
3. Marcar la cotización como `Convertida` (o estado equivalente) y enlazarla al embarque vía `cotizacion_id`.

## Investigación

Ya existe infraestructura clave:
- `useEmbarqueForm` tiene `vincularCotizacion(cot)` / `desvincularCotizacion()` — usados en `NuevoEmbarque.tsx`.
- `useConvertirCotizacionAEmbarques` (en `useCotizacionConversions.ts`) — hace el split por contenedor desde detalle de cotización; ya marca la cotización como `Embarcada` y crea conceptos. Útil pero NO abre el wizard, lo hace en background.
- `NuevoEmbarque.tsx` ya soporta `cotizacionVinculada` vía estado y registra el vínculo (`cotizacion_id`) y cambia estado a `Embarcada`.
- `useCotizacionesAceptadas()` ya alimenta el selector dentro del wizard.
- Estado `Embarcada` ya existe en el enum `estado_cotizacion` (visto en `useCotizacionConversions`).

El estado pedido es "Convertida". Verificar enum existente: el código actual usa `'Embarcada'`. Para no crear migración, usaré `'Embarcada'` que es el valor canónico ya implementado y semánticamente equivalente.

## Diseño

**Flujo elegido**: Navegación desde detalle de cotización al wizard de embarque con la cotización pre-vinculada vía `location.state` (no query param para no exponer IDs ni romper deep-links).

### Cambios

**1. `CotizacionDetalle.tsx`**
- Añadir botón "Crear embarque" en el header de acciones, visible solo si:
  - `canEdit === true`
  - `cotizacion.estado === 'Aceptada'` (regla de negocio: solo aceptadas se convierten)
  - `embarquesVinculados.length === 0` (evitar duplicados; si ya hay embarques, mostrar botón secundario "Crear otro embarque")
- Al click: `navigate('/embarques/nuevo', { state: { cotizacionPrevinculada: cotizacion } })`.

**2. `NuevoEmbarque.tsx`**
- Leer `location.state?.cotizacionPrevinculada` con `useLocation()`.
- En `useEffect` inicial (una sola vez): si existe, llamar `handleVincularCotizacion(cot)` automáticamente.
- Mostrar un toast informativo "Datos pre-rellenados desde cotización {folio}".
- Limpiar `location.state` tras consumirlo (`window.history.replaceState`) para que un refresh no repita.

**3. `useEmbarqueForm.ts` — verificar `vincularCotizacion`**
- Confirmar que ya pre-llena: cliente, modo, tipo, incoterm, descripción mercancía, peso, volumen, piezas, ruta (origen/destino), tipo_carga, tipo_contenedor, operador.
- Si falta algún campo (ej. `num_contenedores`, conceptos), extender el método para que también:
  - Cargue conceptos de venta desde `cotizacion.conceptos_venta` (jsonb) → setea en `useConceptosForm`.
  - Cargue conceptos de costo desde la tabla `cotizacion_costos` (query async).

**4. `useConceptosForm.ts`**
- Exponer setters `setConceptosVenta(items)` y `setConceptosCosto(items)` para hidratar desde cotización (si no existen ya).

**5. Pre-llenado de conceptos (lógica de hidratación)**
- En `NuevoEmbarque.tsx` tras vincular: query `cotizacion_costos` por `cotizacion_id` → mapear a estructura de `conceptosCosto` (concepto, monto=costo_unitario, moneda, proveedor).
- Mapear `cotizacion.conceptos_venta` (jsonb) → estructura de `conceptosVenta` (descripción, cantidad, precio_unitario, moneda).

**6. Marcar cotización como convertida**
- Ya ocurre en `handleFinish` de `NuevoEmbarque.tsx`: `updateEstadoCotizacion.mutateAsync({ id, estado: 'Embarcada' })`. Validar que se ejecuta y registra bitácora.

**7. Changelog v8.39.0**
- Añadir entrada en `src/data/changelogData.ts`.

### Archivos a editar
1. `src/pages/CotizacionDetalle.tsx` — botón "Crear embarque"
2. `src/pages/NuevoEmbarque.tsx` — leer `location.state`, hidratar conceptos
3. `src/hooks/embarque/useEmbarqueForm.ts` — verificar/extender `vincularCotizacion`
4. `src/hooks/useConceptosForm.ts` — exponer setters si faltan
5. `src/data/changelogData.ts` — entrada v8.39.0

### Riesgos
- Bajo. El botón es aditivo, el wizard ya soporta vinculación manual.
- Posible duplicación si el usuario abandona el wizard tras vincular: la cotización no cambia de estado hasta `handleFinish`, así que es seguro.

### Validación post-implementación
- Test manual: abrir cotización Aceptada → botón visible → click → wizard abre con datos → completar → embarque creado con `cotizacion_id` → cotización pasa a `Embarcada`.
- Correr `npm test` para asegurar 139/139.
