# Reestructurar wizard de cotización marítima (importación)

## Problema

Hoy el Paso 1 le pide a ventas (en `SeccionRutaCotizacion.tsx`) datos que solo conoce pricing/costeo:

- Tiempo de tránsito (días)
- Días libres en destino (FCL)
- Carta garantía sí/no
- Frecuencia (Semanal/Quincenal/…)
- Días de almacenaje (LCL)

Sí existe auto-fill cuando se vincula una tarifa (`TarifaVinculadaPanel` → `aplicarTarifa.ts`), pero los campos se muestran como **inputs editables desde el inicio**, antes de elegir tarifa. Eso obliga a ventas a "saber o adivinar" y rompe la separación con pricing.

Además, dos campos hoy **no tienen origen en la tarifa** y siempre son manuales:

- `frecuencia` (no existe columna en `costeo_tarifas` ni `costeo_navieras_condiciones`)
- `diasAlmacenaje` (LCL)

## Nuevo flujo propuesto (importación marítima)

```text
Paso 1 — Cliente y ruta (lo que ventas SÍ sabe)
  1.1  Cliente / Prospecto + CRM
  1.2  Datos generales: Modo (Marítimo), Tipo (Importación), Incoterm
  1.3  Ruta mínima: Origen (puerto), Destino (puerto)
  1.4  Mercancía mínima: FCL/LCL, Tipo de contenedor (FCL) o m³/kg (LCL)
  1.5  Nº contenedores / volumen, valor de mercancía, seguro sí/no

Paso 2 — Selección de tarifa (gate obligatorio)
  - Sugerencias Top 3 inline (ya existe) filtradas por origen+destino+contenedor
  - "Buscar tarifa" abre dialog
  - Panel de detalle SOLO lectura con todo lo heredado:
      · Naviera, Agente
      · Tiempo de tránsito
      · Frecuencia  (nuevo: viene de tarifa/naviera)
      · Días libres demoras destino
      · Carta garantía (con vigencia)
      · Tabulador de demoras (preview)
      · Validez de la tarifa
      · Flete base + recargos (preview)
  - No se puede avanzar sin tarifa vinculada (mantiene regla actual)
  - Botón discreto "Editar manual (operaciones)" colapsado por defecto, gated
    por rol (admin/operador/pricing). Ventas no lo ve.

Paso 3 — Costos & P&L
  - Igual que hoy: auto-cargado desde tarifa + recargos
  - Sigue existiendo "Cotizar sin desglose"

Paso 4 — Conceptos de venta (USD + MXN)
Paso 5 — Resumen y confirmar
```

Resultado: ventas captura **6 cosas** en Paso 1 (cliente, modo, tipo, incoterm, origen, destino, contenedor) → elige tarifa → todo lo demás se hereda.

## Cambios concretos

### Frontend (sin tocar lógica de costeo)

1. **Reordenar Paso 1** en `CotizacionWizardSteps.tsx` / `useCotizacionWizardSteps.ts`: separar el actual Paso 1 en dos pasos lógicos — "Cliente/Ruta/Mercancía mínima" y "Tarifa vinculada".
2. `**SeccionRutaCotizacion.tsx**`: quitar de la vista de ventas los campos `tiempoTransitoDias`, `diasLibresDestino`, `cartaGarantia`, `frecuencia`, `diasAlmacenaje`. Conservar solo: origen, destino, `rutaTexto`, `validezPropuesta`, `tipoMovimiento`, `seguro`/`valorSeguroUsd`.
3. `**TarifaVinculadaPanel.tsx**`: convertir en el nuevo "Paso 2" del wizard. Mostrar como **tarjeta de solo lectura** todos los datos heredados (tránsito, frecuencia, días libres, carta garantía + vigencia, demoras escalonadas, recargos preview). Cada campo con badge "Heredado de tarifa".
4. **Override gated por rol**: el toggle "Editar manual" usa `useEffectiveRole` y solo aparece para `admin`, `operador`, `pricing` (no `ventas`). Al activar, expone los inputs y marca `tarifaOverride.<campo> = true` (lógica que ya existe).
5. **Validaciones del wizard** (`useCotizacionWizardSteps.ts`): bloquear avance al paso de tarifa si falta origen/destino/contenedor; bloquear avance a costos si no hay `tarifaId`.

### Backend (datos faltantes en tarifa)

6. **Migración 1 — `frecuencia` en costeo**: agregar columna `frecuencia` (enum: `Diaria`, `Semanal`, `Quincenal`, `Mensual`, `Bajo demanda`) a `costeo_navieras_condiciones` (es propiedad del servicio de la naviera por ruta, no de la tarifa individual). Opcional override en `costeo_tarifas.frecuencia_override`.
7. **Migración 2 — `dias_almacenaje_lcl**`: agregar `dias_almacenaje_destino` a `costeo_tarifas` (o `costeo_navieras_condiciones`) para que LCL también herede.
8. `**aplicarTarifa.ts**`: extender el auto-fill para incluir `frecuencia` y `diasAlmacenaje` cuando vengan de la tarifa/naviera.

### Sin cambios

- Esquema de `cotizaciones` (columnas `frecuencia`, `dias_almacenaje`, `tiempo_transito_dias`, etc. ya existen).
- Lógica de `costeo_tarifa_recargos`, `costeo_naviera_demoras_tarifa`, `costeo_navieras_condiciones` (solo se leen).
- Paso 2 (Costos & P&L), Paso 3 (Conceptos de venta), Paso 4 (Resumen).
- "Cotizar sin desglose".

## Detalles técnicos

- `tarifaOverride: Record<string, boolean>` ya existe y se extiende con `frecuencia` y `diasAlmacenaje`.
- El badge "Heredado" ya está en `SeccionRutaCotizacion`; se reutiliza el componente moviéndolo al panel de tarifa.
- Rol gate: usar `useEffectiveRole()` + `ROLES_OPERATIVOS` (ya existen en `seguridad-y-roles`).
- Memorias a actualizar al implementar: `mem://features/costeo-tarifas-maritimas` (agregar `frecuencia`/`dias_almacenaje`), nueva memoria `mem://features/wizard-cotizacion-flujo` con el orden de pasos y el contrato "ventas solo captura ruta+contenedor".

## Fuera de alcance

- Exportación marítima, aéreo, terrestre, multimodal (otra iteración, mismo principio aplica).
- Reescribir `BuscarTarifaDialog` o el algoritmo de Top 3.
- Cambiar el modelo de P&L.

## Preguntas para validar antes de construir

1. ¿`frecuencia` vive en **naviera+ruta** (`costeo_navieras_condiciones`) o por **tarifa individual** (`costeo_tarifas`)? Propuesta: naviera+ruta, con override opcional en tarifa.
2. ¿`diasAlmacenaje` LCL aplica solo a LCL o también queremos partir `dias_libres_demoras` por modalidad? LCL y FCL tienen distintos dias libres de almacenaje
3. ¿El override manual lo puede hacer `pricing` y `operador`, o solo `admin`? Propuesta: admin y la gerente comercial
4. ¿Mantenemos "Cotizar sin desglose" disponible para ventas, o también lo gate-amos por rol? role gated