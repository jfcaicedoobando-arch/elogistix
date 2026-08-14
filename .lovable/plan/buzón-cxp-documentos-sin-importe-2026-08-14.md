# Buzón CxP: documentos sin importe

## Qué está pasando (verificado en datos)

Revisé los últimos 25 documentos del buzón. El patrón es exacto:

- Documentos **con XML (CFDI)**: siempre traen importe (`261.00 USD`, `70,180.00 MXN`, etc.).
- Documentos **sólo PDF** (debit notes de navieras extranjeras: `NQDEC…`, `WDMFT…`, `EGLV…`): **todos sin importe**.

La causa está en el modal "Subir factura al buzón": el monto se **prellena automáticamente sólo cuando se lee el XML**. Si el proveedor mandó únicamente PDF, el campo queda vacío y el botón de enviar **no exige** llenarlo — el documento se sube igual, sin importe.

Analogía: el formulario tiene un campo que se llena solo cuando hay código de barras (XML). Sin código de barras hay que teclearlo a mano, y hoy nadie obliga a hacerlo.

## Cambios propuestos

### 1. El monto deja de ser opcional
- El botón "Enviar al buzón" se habilita sólo con **monto > 0 y moneda** elegidos.
- Si el documento trae XML, sigue prellenándose y el operador sólo confirma.
- Si el operador marcó conceptos de costo, se ofrece **"Usar la suma de lo marcado"** (un clic) para no teclear.
- Sigue siendo un aviso, no bloqueo, la diferencia contra lo costeado: sólo el hecho de capturar un monto pasa a ser obligatorio.

### 2. Señal clara en el buzón
- En `/compras/buzon`, los documentos sin importe muestran un chip ámbar **"Sin importe"** en lugar de un guion, con acción directa **"Agregar importe"** que abre el modal de corrección existente.
- Filtro rápido "Sin importe" para que operaciones limpie el rezago.

### 3. Rezago actual
No se toca la base de datos: los ~12 documentos sin importe quedan visibles con el chip ámbar para que el operador los complete desde el buzón (`Corregir datos`), que ya guarda `monto_declarado` / `moneda_declarada`.

## Detalles técnicos

- `useSubirEntranteForm.ts`: agregar `montoDeclarado != null && montoDeclarado > 0` a la condición `listo`; nuevo callback `usarSumaSugerida()` que toma `sumaSugeridaPorMoneda` de la moneda actual.
- `VerificacionMontoEntrante.tsx`: `Label` con marca de obligatorio, mensaje de validación cuando está vacío y botón "Usar la suma de lo marcado" (visible sólo si hay conceptos marcados en esa moneda).
- `FacturaEntranteItem.tsx` y la tabla del buzón (`pendientesDeCaptura.ts` / vista `/compras/buzon`): render del chip "Sin importe" cuando `monto_declarado == null && total_detectado == null`, con botón que abre `CorregirDatosEntranteDialog`.
- Filtro cliente "Sin importe" en los filtros del buzón (sin cambios de RPC ni de esquema).
- Tests: `useSubirEntranteForm` (no listo sin monto; listo tras usar la suma), y render del chip en `FacturaEntranteItem`.
- `CHANGELOG.md` + `APP_VERSION` → 13.618.0.
