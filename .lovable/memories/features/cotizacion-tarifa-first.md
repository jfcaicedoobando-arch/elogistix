---
name: Cotización tarifa-first
description: Política y mecánica del wizard de cotización marítima que obliga vincular tarifa antes del Paso 2, con auto-carga de costos y venta sugerida.
type: feature
---
Wizard de cotización marítima (`src/features/cotizacion/components/wizard/PasoDatosGenerales.tsx`):

**Orden del Paso 1 cuando `modo === "Marítimo"`** (v13.35.0):
1. Cliente
2. Operación (modo/tipo/incoterm)
3. Ruta (origen, destino, validez, tránsito, días libres)
4. **Tarifa marítima vinculada** ← guardián
5. Mercancía (tipo contenedor, peso, dimensiones)
6. Cierre (número de embarques, notas)

Aéreo/Terrestre/General: orden tradicional sin sección Tarifa.

**Bloqueo duro**: `validatePaso1` (`src/features/cotizacion/hooks/wizard/handlePaso1Crm.ts`) retorna error y registra `cotizacion_bloqueada_sin_tarifa` en `bitacora_actividad` si marítimo + sin `tarifaId`. Mensaje al usuario: "Vincula o crea una tarifa marítima antes de continuar".

**Auto-carga de costos** (`aplicarTarifaAlForm` + `buildCostosDesdeTarifa`):
- Se ejecuta al elegir tarifa desde sugerencias inline o `BuscarTarifaDialog`.
- Descarga recargos vía `fetchRecargosDeTarifa(tarifaId)`.
- Genera filas `FilaCostoLocal[]` con `costo_unitario = monto`, `precio_venta = costo × (1 + markup)`, `moneda: "USD"`, `cantidad = numContenedores`, `proveedor = naviera`.
- Marca cada fila con `notas = "Auto-cargado desde tarifa marítima"` para distinguir de capturas manuales y permitir reemplazo limpio al cambiar de tarifa.

**Markup configurable**: leído con `useConfigValue<number>("cotizaciones", "markup_default_maritimo", 0.15)`. Fallback 15%. Configurable vía tabla `configuracion` (categoría `cotizaciones`, clave `markup_default_maritimo`).

**CTA "Crear tarifa"**: en `TarifaVinculadaPanel`, navega a `/costeo/tarifas?origen=...&destino=...&tipoContenedor=...&returnTo=/cotizaciones/nueva` cuando el usuario no encuentra una tarifa adecuada.

Componentes/archivos clave:
- `src/features/cotizacion/components/TarifaVinculadaPanel.tsx` (guardián + CTA)
- `src/features/cotizacion/components/seccionRuta/SugerenciasTarifaInline.tsx` (Top 3 sugerencias)
- `src/features/cotizacion/components/seccionRuta/aplicarTarifa.ts` (`aplicarTarifaAlForm` con `AplicarTarifaOptions`)
- `src/features/cotizacion/components/seccionRuta/buildCostosDesdeTarifa.ts` (helper puro)
