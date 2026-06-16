# Plan — Continuación optimización cotizaciones

Bloque 2 (cotizar sin desglose + candado embarque) ya quedó implementado en v13.27.0. Este plan cubre los dos bloques restantes.

---

## Bloque 1 — Reordenar Paso 1 del wizard (UX conversacional)

**Objetivo:** que el llenado siga el orden natural en que un ejecutivo piensa la cotización, con validación inline y resumen sticky.

### Nuevo orden de secciones (acordeones)
```text
1. Cliente            (cliente + contacto + vendedor)
2. Operación          (modo transporte, tipo operación, incoterm)
3. Ruta               (origen, destino, tránsito sugerido)
4. Mercancía          (FCL/LCL, contenedor, # piezas, peso, vol, dims, MSDS/peligroso)
5. Tarifa vinculada   (sólo marítimo, botón "Sugerir tarifa" usando ruta+contenedor)
6. Condiciones        (días libres, almacenaje, seguro, carta garantía)
7. Cierre             (# embarques estimados + Notas)  ← acordeón abierto por default
```

### Tácticas UX
- Sidebar sticky derecho con resumen vivo (cliente, ruta, contenedor, tarifa) y CTA "Continuar a costos".
- Validación inline por sección (no esperar al submit).
- Badge "Heredado de tarifa" en campos que se autocompletan al elegir tarifa marítima.
- Botón "Sugerir tarifa" en sección 5 que filtra `costeo_tarifas` por ruta + contenedor y muestra Top 3.
- Cada acordeón muestra check verde cuando sus campos requeridos están completos.

### Archivos a tocar
- `src/features/cotizacion/components/wizard/Paso1Datos.tsx` (reordenar secciones, agregar acordeones con estado de validez).
- `src/features/cotizacion/components/wizard/CotizacionWizardLayout.tsx` (sidebar resumen sticky).
- Nuevo: `src/features/cotizacion/components/wizard/ResumenStickyCotizacion.tsx`.
- Nuevo: `src/features/cotizacion/components/wizard/SugerirTarifaButton.tsx` (consulta a `costeo_tarifas`).
- Nuevo: `src/features/cotizacion/components/wizard/HeredadoBadge.tsx` (reutilizable también en Bloque 3).

**Fuera de alcance:** no se cambian validaciones de negocio, ni Paso 2/3, ni el schema.

---

## Bloque 3 — Precarga ampliada cotización → embarque

Hoy `mapConceptosVentaFromCotizacion` y `mapConceptosCostoFromCotizacion` ya copian conceptos. Falta heredar el resto del contexto operativo.

### Campos adicionales a precargar
- **Ruta:** origen, destino, tránsito.
- **Mercancía:** `tipo_carga`, `tipo_embarque`, `tipo_contenedor`, # contenedores, peso, volumen, piezas, dimensiones.
- **MSDS / peligrosos:** flag + clase IMO + UN number.
- **Condiciones:** días libres demoras, almacenaje, seguro, carta garantía.
- **Tarifa marítima:** se pasa como `tarifa_id` (referencia, no copia de valores).
- **Notas internas / cliente.**

### Reglas
- Cada campo heredado lleva badge "Heredado de cotización FOLIO-XXX" (componente `HeredadoBadge` compartido con Bloque 1).
- Cambios en el embarque **no** modifican la cotización origen.
- Al desvincular cotización del embarque: modal con 3 opciones — conservar datos, limpiar sólo conceptos, limpiar todo lo heredado.

### Archivos a tocar
- `src/lib/mappers/embarqueWizard.ts` (extender mapper actual con los nuevos campos).
- `src/features/embarques/hooks/useNuevoEmbarqueCotVinculada.ts` (consumir el mapper extendido).
- `src/features/embarques/components/wizard/*` (mostrar badge "Heredado" en campos precargados).
- Nuevo: `src/features/embarques/components/DesvincularCotizacionDialog.tsx`.

**Fuera de alcance:** no se cambia el wizard de embarques (sólo recibe más campos pre-llenados), ni se altera el cálculo de margen.

---

## Preguntas antes de implementar

1. ¿Default en desvinculación: **"Conservar datos"** o **"Limpiar sólo conceptos"**?
2. ¿"Sugerir tarifa" debe ser botón manual o auto-trigger en cuanto ruta + contenedor estén llenos?
3. ¿El sidebar sticky de resumen lo quieres también en Paso 2 y Paso 3, o sólo Paso 1?

---

## Entregables
- Bump `APP_VERSION` a `13.28.0` y entrada en `CHANGELOG.md`.
- Sin migraciones nuevas (todo el schema ya existe).
- Tests: actualizar `embarqueWizard.test.ts` con los campos nuevos.
