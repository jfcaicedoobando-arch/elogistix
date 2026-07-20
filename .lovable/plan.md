## Diagnóstico

El error `LC_TRANSICION_INVALIDA: En Aduana → Entregado` viene del botón "Avanzar estado" del detalle de embarque. `useEmbarqueEstadoActions.helpers.ts::getSiguienteEstado` calcula el siguiente estado usando el orden de la constante UI:

```ts
ESTADOS_EMBARQUE = ['Borrador','Confirmado','En Tránsito','Arribo','En Aduana','Entregado','EIR','Cerrado']
```

Pero la máquina de estados de BD (migración `20260718214722`, verificada por el guardrail `grafo-transiciones-embarque-fase-g.test.ts`) es:

```
Borrador → Cotización → Confirmado → En Tránsito → En Aduana → Llegada → Arribo → Entregado → EIR → Cerrado
```

Diferencias:
- Faltan `Cotización` y `Llegada` en la constante UI.
- El orden entre `En Tránsito`, `En Aduana`, `Llegada` y `Arribo` está intercambiado. Desde `En Aduana` la UI ofrece `Entregado` (inválido); la BD sólo permite `Llegada`. El hint del error lo confirma: `transiciones_permitidas: Cancelado,En Aduana,En Tránsito,Llegada`.

Analogía: la UI está usando un manual de rutas viejo — cree que después de "Aduana" viene "Entregado", pero el sistema oficial ahora exige pasar primero por "Llegada" y "Arribo".

## Fix (una sola fuente de verdad)

### 1. `src/features/embarques/constants/embarqueConstants.ts`
Sincronizar con el grafo de BD:

```ts
export const ESTADOS_EMBARQUE = [
  'Borrador','Cotización','Confirmado','En Tránsito',
  'En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'
] as const;

export const ESTADOS_ACTIVOS = [
  'Cotización','Confirmado','En Tránsito','En Aduana','Llegada','Arribo','Entregado'
] as const;
```

### 2. Verificar consumidores (sin cambios de lógica esperados)
- `useEmbarqueEstadoActions.helpers.ts::getSiguienteEstado` — automáticamente correcto tras el reordenamiento.
- `EstadoProgresoCard.tsx` — el stepper mostrará 10 pasos en vez de 8 (esperado, refleja realidad de la BD).
- `TabResumen.tsx` — sigue derivando `currentStepIndex` con `indexOf`, funciona.
- `EmbarquesFiltros.tsx` — dropdown de filtro estado gana 2 opciones nuevas (`Cotización`, `Llegada`), consistente con datos que ya existen en BD.
- `usePortalDashboardKpis.ts` — ordenamiento por índice sigue correcto.

### 3. Tests
- Nuevo `src/features/embarques/hooks/__tests__/useEmbarqueEstadoActions.helpers.test.ts` (o extender uno existente) con casos:
  - `getSiguienteEstado('En Aduana') === 'Llegada'` (regresión directa de requestId `c80465e4`).
  - `getSiguienteEstado('En Tránsito') === 'En Aduana'`.
  - `getSiguienteEstado('Llegada') === 'Arribo'`.
  - `getSiguienteEstado('Arribo') === 'Entregado'`.
  - `getSiguienteEstado('Borrador') === 'Cotización'`.
  - `getSiguienteEstado('Cerrado') === null`.
- Guardrail nuevo `src/features/embarques/constants/__tests__/estados-embarque-sync.test.ts` que valida que la secuencia coincide con la extraída del SQL de `20260718214722_*.sql` (previene que se vuelvan a desincronizar UI y BD).

### 4. Housekeeping
- Bump `APP_VERSION` → `13.302.10`.
- Entrada en `CHANGELOG.md` referenciando requestId `c80465e4-58c1-4e54-a601-82f25b011e97`.
- Resolver el issue en Sentry con `update_issue` (fixVersion `13.302.10`) siguiendo la memoria `sentry-resolve`.

## Fuera de alcance

- No se altera la máquina de estados de BD ni triggers.
- No se cambia el candado de docs por estado (`_docs_requeridos_por_estado`); ya cubre `Llegada` según memoria `candado-docs-avance-estado`.
- No se modifica `calcularEstadoEmbarque` (fix v13.302.9 sigue vigente: sólo `Confirmado`, `En Tránsito`, `Llegada` son auto-calculables).
- No se toca UI del wizard de creación (los estados iniciales `Borrador`/`Cotización` no se ofrecen manualmente ahí).
