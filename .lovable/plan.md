## Objetivo
Mostrar los datos bancarios en la página de detalle del proveedor y permitir actualizar sus datos fiscales subiendo una CSF, validando que la constancia pertenezca al proveedor antes de aplicar cambios.

## Cambios

### 1. Traer todas las columnas relevantes al detalle
`src/services/proveedor/index.ts` — `PROVEEDOR_DETAIL_COLUMNS` actualmente omite `banco`, `clabe`, `cp`, `direccion`, `ciudad`, `estado`, `regimen_fiscal`. Agregarlos para que el detalle pueda leerlos.

### 2. Sección "Datos bancarios" en el detalle
`src/pages/proveedores/ProveedorDetalle.tsx` — Añadir una nueva `Card` debajo del grid de totales:
- **Banco:** nombre o "No capturado" en muted.
- **CLABE interbancaria:** se muestra enmascarada (`••••••••••••XXXX` mostrando solo los últimos 4 dígitos) con un botón ojo (mostrar/ocultar). Si no hay CLABE, "No capturado".
- Visible siempre (no solo para nacionales) — si no hay datos, sirve como CTA visual para capturarlos en Editar.

### 3. Botón "Actualizar con CSF" junto a "Editar"
En el header de acciones del detalle, agregar un nuevo botón con icono `Upload` que abre un `<input type="file" accept="application/pdf">` oculto. Solo se muestra para proveedores **nacionales** (los extranjeros no tienen CSF).

Flujo al seleccionar archivo:
1. Spinner en el botón (estado `csfLoading`).
2. Llamar `parseCsf(file)` (servicio existente).
3. **Validación de pertenencia** (crítico):
   - Normalizar el RFC extraído (`upper + trim`) y compararlo contra `proveedor.rfc` normalizado.
   - Si **no coinciden** → toast destructivo: `"La CSF pertenece a {nombreExtraído} (RFC {rfcExtraído}) y no a este proveedor ({proveedor.rfc}). No se actualizó nada."` Abortar.
   - Si **coinciden** → seguir con el update.
4. Llamar `handleUpdate(proveedor.id, { cp, direccion, ciudad, estado, regimen_fiscal, nombre })` solo con los campos que vinieron en la CSF (no pisar con vacíos).
5. Toast de éxito: `"Datos fiscales actualizados desde CSF"`.

Errores de parsing (`parseCsf` lanza): toast con el mensaje del servicio.

### 4. Versionado
- `APP_VERSION` → `12.76.25`.
- Entrada en `CHANGELOG.md`: "Datos bancarios visibles en detalle de proveedor + botón para actualizar con CSF validando RFC."

## Notas técnicas
- La validación de pertenencia se hace en el cliente comparando RFCs. Es suficiente porque la CSF del SAT incluye el RFC en el PDF y el edge function `parse-csf` ya lo extrae. Si en el futuro queremos endurecer, se puede hacer la verificación en el edge function mismo (que reciba el `proveedorId` y rechace antes de devolver datos), pero para esta iteración el chequeo cliente es válido — la BD queda intacta hasta que el usuario confirma el match.
- Para CLABE enmascarada: helper local simple (no agregar al index de utils porque es uso único).
- No se agregan nuevas columnas a BD; todo ya existe.
- `EditarProveedorDialog` actualmente no incluye `banco/clabe` (se capturan al alta en el paso 2). Queda fuera de esta tarea (el usuario los puede recapturar dando de alta de nuevo, o pediremos extender el edit en una siguiente iteración si lo solicita).

## Archivos afectados
- `src/services/proveedor/index.ts` (constante de columnas)
- `src/pages/proveedores/ProveedorDetalle.tsx` (sección bancaria + botón CSF + handler)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`
