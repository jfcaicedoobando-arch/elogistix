## Diagnóstico

Estado actual de ELIMP00203 en BD:
- `estado = "En Tránsito"`, `etd = 2026-04-07`, `eta = 2026-05-17`, `fecha_llegada_real = 2026-05-03`.

Por qué falló la actualización al hacer click en "Actualizar embarque":

1. **El banner ya no aparecía.** En `TrackingLiveCard.tsx` la sugerencia solo se muestra si alguno de `etd/eta/ata` difiere de lo guardado. Como JSONCargo ya había escrito antes la ATA (2026-05-03) y la ETA propuesta coincide con la guardada, `ataDifiere = false` y `etaDifiere = false` → no se ofrece nada que aplicar. El click probablemente fue en "Actualizar" (sincronizar tracking), no en "Actualizar embarque".

2. **El estado no avanzó a "Arribo".** La nueva lógica de auto-avance en `useApplyJsonCargoFechas` (v8.135.3) solo dispara cuando se está aplicando una ATA nueva en esa misma llamada. Para embarques que ya tenían `fecha_llegada_real` escrita antes de esa versión, nunca se vuelve a evaluar.

3. **El auto-sync de estado del detalle (`useEmbarqueEstadoActions`) usa `calcularEstadoEmbarque`**, que solo compara hoy contra ETA. Como ETA = 2026-05-17 está en el futuro, devuelve "En Tránsito" y el estado se queda atascado, ignorando que ya hay arribo real.

## Plan

### 1. Extender `calcularEstadoEmbarque` para considerar `fecha_llegada_real`

En `src/lib/domain/embarque.ts`:
- Agregar parámetro opcional `fechaLlegadaReal: string | null`.
- Antes del cálculo por ETA/ETD: si `fechaLlegadaReal` existe y `estadoActual` es `"Confirmado"` o `"En Tránsito"`, devolver `"Arribo"`.
- Nunca retroceder estados manuales (`Arribo`, `En Aduana`, `Entregado`, `EIR`, `Cerrado`) — esto ya lo protege la guarda existente al inicio de la función.

### 2. Pasar `fecha_llegada_real` en todos los callers

Actualizar las llamadas en (todos con cambio mecánico de firma):
- `src/hooks/embarque/useEmbarqueEstadoActions.ts` — además incluir `embarque?.fecha_llegada_real` en las deps del `useEffect` para que dispare el auto-sync apenas se guarde la ATA.
- `src/hooks/embarque/useEmbarquesPageState.ts`
- `src/hooks/embarque/useEmbarquesPageController.ts`
- `src/hooks/embarque/usePortalEmbarqueDetalleController.ts`
- `src/hooks/portal/usePortalEmbarquesController.ts`
- `src/hooks/portal/usePortalDashboardKpis.ts`
- `src/pages/embarques/EmbarqueDetalle.tsx`
- `src/pages/portal/PortalEmbarques.tsx`
- `src/components/embarque/embarqueColumns.tsx`
- `src/components/portal/EmbarqueCard.tsx`
- `src/components/portal/dashboard/PortalEmbarquesRecientesCard.tsx`

El parámetro se mantiene opcional para evitar romper consumidores incidentales; comportamiento sin él queda idéntico al actual.

El auto-sync existente en `useEmbarqueEstadoActions` ya llama a `useSyncEstadoEmbarque`, que internamente hace `actualizarEstadoEmbarque` + `insertarEventoTracking` ("Arribo a Puerto"), por lo que el evento de la línea de tiempo queda cubierto sin código nuevo.

### 3. Banner del tracking: permitir alinear ETA al arribo real ya guardado

En `src/components/embarque/TrackingLiveCard.tsx`, dentro del bloque que decide si mostrar la sugerencia de fechas:
- Añadir un caso `etaDesalineadaPorAta`: si `fechaLlegadaReal` existe y `eta !== fechaLlegadaReal`, ofrecer aplicar `eta = fechaLlegadaReal` aunque JSONCargo no proponga cambio.
- Incluirlo como otra fila en la lista de cambios sugeridos y enviarlo en `applyFechas.mutateAsync({ eta: fechaLlegadaReal })`.
- Texto: "ETA destino (se alineará al arribo real)".

Esto da una salida manual para los embarques que quedaron desfasados antes de los cambios automáticos.

### 4. Changelog y versión

- Bump `APP_VERSION` a `8.135.4` en `src/constants/appVersion.ts`.
- Entradas patch en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` describiendo: auto-avance a "Arribo" cuando existe `fecha_llegada_real`, y opción de alinear ETA al ATA desde el panel de tracking.

## Detalle técnico

Pseudo-firma nueva:

```ts
calcularEstadoEmbarque(
  modo, tipo, etd, eta, estadoActual,
  fechaLlegadaReal?: string | null,
): string {
  if (ESTADOS_MANUALES.includes(estadoActual)) return estadoActual;
  if (fechaLlegadaReal && (estadoActual === "Confirmado" || estadoActual === "En Tránsito")) {
    return "Arribo";
  }
  // ...resto igual
}
```

No se tocan RLS, edge functions ni esquema de BD. Sin riesgo de retroceder estados posteriores porque la guarda `ESTADOS_MANUALES` ya cubre `Arribo`/`En Aduana`/`Entregado`/`EIR`/`Cerrado`.
