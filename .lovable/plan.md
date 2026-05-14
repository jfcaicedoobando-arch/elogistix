## Objetivo

Construir una vista de tracking por embarque que muestre una **línea de tiempo de fases canónicas** del ciclo de vida (Cotización → Confirmado → En Tránsito → Llegada → Cerrado) además de las notas existentes. Hoy el tab "Tracking" muestra eventos libres y notas, pero no un resumen visual del avance por fases.

## Alcance

Solo cambios de presentación en el tab Tracking del detalle de embarque (`/embarques/:id?tab=tracking`). No se modifica la base de datos, ni los hooks, ni la lógica de negocio.

## Diseño de la línea de tiempo

Stepper horizontal en desktop / vertical en móvil, con 5 hitos:

```text
●────●────●────●────○
Cot. Conf. Trán. Lleg. Cerr.
```

Para cada hito se muestra:
- Ícono y nombre de la fase
- Fecha asociada (cuando se conozca)
- Estado visual: completado (accent), actual (accent + ring), pendiente (muted)

### Mapeo de fases a datos existentes

| Fase | Fuente de fecha | Considerada completada cuando |
|---|---|---|
| Cotización | `cotizaciones.created_at` vía `embarques.cotizacion_id` (si existe) | Hay `cotizacion_id` |
| Confirmado | `embarques.fecha_creacion` | Siempre (el embarque existe) |
| En Tránsito | `embarques.etd` | `hoy >= etd` o estado ∈ {En Tránsito, Arribo, En Aduana, Entregado, EIR, Cerrado} |
| Llegada | `embarques.fecha_llegada_real ?? embarques.eta` | Hay `fecha_llegada_real` o estado ∈ {Arribo, En Aduana, Entregado, EIR, Cerrado} |
| Cerrado | `embarques.updated_at` cuando estado = Cerrado | Estado = Cerrado |

La fase "actual" se calcula reusando `calcularEstadoEmbarque` de `src/lib/domain/embarque.ts`.

## Cambios de código

1. **Nuevo componente** `src/components/embarque/TrackingFasesTimeline.tsx`
   - Recibe el `embarque` (subset de campos) como prop.
   - Función pura `calcularFasesEmbarque(embarque)` que devuelve `Array<{ id, label, icon, fecha, estado: 'completada' | 'actual' | 'pendiente' }>`.
   - Render con stepper responsive usando tokens semánticos (`bg-accent`, `bg-muted`, `text-muted-foreground`, `border-border`). Sin colores hardcoded.
   - Helper `renderHito(fase)` para evitar ternarios anidados.

2. **Lógica de fases** `src/lib/domain/embarqueFases.ts`
   - Exporta `calcularFasesEmbarque(embarque, cotizacionCreatedAt?)`.
   - Tests unitarios en `__tests__/embarqueFases.test.ts` cubriendo: solo confirmado, en tránsito, con llegada real, cerrado, sin cotización.

3. **Integración** en `src/components/embarque/TabTracking.tsx`
   - Insertar `<TrackingFasesTimeline embarque={embarque} cotizacionCreatedAt={...} />` arriba del `TrackingLiveCard`.
   - Si se necesita la fecha de la cotización, exponerla desde `useEmbarqueFull` (ya trae el embarque; agregar un `select` mínimo `cotizaciones(created_at)` si está accesible por RLS — alternativa: usar solo `fecha_creacion` para Cotización si no hay `cotizacion_id`).

4. **Sección de notas en el tab Tracking**
   - Agregar `<TabNotas notas={notas} embarqueId={embarqueId} />` debajo del timeline de eventos para tener notas accesibles desde el mismo tab (sin duplicar — el tab "Notas y Actividad" sigue existiendo). Pasar `notas` desde `EmbarqueDetalle.tsx` como prop adicional a `TabTracking`.

5. **Changelog**
   - Bump de versión patch en `src/constants/appVersion.ts` y entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Detalles técnicos

- Reusar `ICONO_EVENTO` y tokens existentes (no nuevos colores).
- Sin nested ternaries: usar helpers `getEstadoFase()` y `renderHito()`.
- Layout: `flex-col md:flex-row` con conector (`div` con `bg-border`) entre hitos.
- Sin cambios a Supabase, sin migraciones.

## Fuera de alcance

- Edición manual de fechas de fases.
- Notificaciones automáticas al cambiar de fase.
- Tracking público (`TrackingPublico.tsx`) — se podría aplicar el mismo componente después si se desea.
