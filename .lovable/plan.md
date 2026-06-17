## Objetivo

La fecha de "Validez de la propuesta" no debe poder exceder la fecha `vigente_hasta` de la tarifa seleccionada. Hoy sólo se muestra una advertencia visual (`vencidaAntesDeValidez`) pero el usuario aún puede guardar una validez mayor.

## Cambios

### 1. `SeccionRutaCotizacion.tsx` (calendario de validez)
- Leer la tarifa vinculada actual (`watch("tarifaVinculada")` o el panel ya expuesto) para obtener `vigente_hasta`.
- Pasar `disabled={(date) => date < hoy || (tarifaHasta && date > tarifaHasta)}` al `<Calendar>`.
- Si al seleccionar una tarifa la validez ya guardada supera `vigente_hasta`, recortarla automáticamente con `setValue("validezPropuesta", tarifaHasta, { shouldValidate: true, shouldDirty: true })` + `trigger()`.
- Mostrar texto de ayuda: "Máximo DD/MM/AAAA según la tarifa seleccionada".

### 2. `aplicarTarifa.ts`
- Al aplicar/cambiar una tarifa, si `validezPropuesta` actual > `tarifa.vigente_hasta`, sobreescribirla al `vigente_hasta` de la tarifa (misma regla de RHF: `shouldValidate`, `shouldDirty`, `trigger`).
- Si no hay validez previa, dejar el flujo actual (no auto-asignar).

### 3. Validación (Zod schema de la cotización)
- Añadir refinamiento opcional: si el form trae `tarifaVinculada.vigente_hasta`, entonces `validezPropuesta <= vigente_hasta`. Mensaje: "La validez no puede exceder la vigencia de la tarifa (DD/MM/AAAA)".
- Esto bloquea el avance del wizard y el guardado.

### 4. `TarifaVinculadaPanel.tsx`
- Reemplazar el warning `vencidaAntesDeValidez` por un mensaje informativo de que la validez fue recortada automáticamente (o dejarlo si la regla nueva la hace imposible).

### 5. Sin cambios de backend ni migraciones
- La columna `valido_hasta` de `cotizaciones` ya existe; sólo cambia la regla de captura en UI.

### 6. Versionado y changelog
- Bump `APP_VERSION` a `13.47.1`.
- Entrada en `CHANGELOG.md` describiendo el cap.

## Fuera de alcance
- Cambiar el modelo de `cotizaciones` o `costeo_tarifas`.
- Validar retroactivamente cotizaciones ya guardadas con validez > vigencia.
- Aéreo / terrestre (sólo aplica a marítimo importación, donde existe tarifa vinculada).
