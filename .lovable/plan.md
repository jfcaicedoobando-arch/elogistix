
## Objetivo

Simplificar el ciclo de vida del embarque eliminando el paso administrativo **Propuesta** (valor DB `Cotización`). Nuevo flujo:

```text
Borrador → Confirmado → En Tránsito → En Aduana → Arribo → Entregado → Cerrado
```

Motivo: el estado no representa una aprobación real; solo agrega clics y contamina reportes. Además coincide en nombre con el documento comercial COT-XXXX, lo que genera confusión.

## Alcance

Cambio de **workflow** (máquina de estados + UI). No tocamos negocio financiero, RLS ni permisos.

## Estrategia con el enum

El enum `public.estado_embarque` conserva el valor `'Cotización'` como **deprecado** (quitarlo requiere reescribir 100+ referencias y regenerar tipos con riesgo). En su lugar:
- La máquina de estados en BD lo rechaza como destino.
- La UI no lo ofrece en filtros, steppers ni acciones.
- Los embarques existentes en ese estado se migran a `Borrador` (más seguro: preservan editabilidad; el usuario decide cuándo confirmar).

## Cambios

### 1. Datos (migración con `supabase--insert`)
- `UPDATE public.embarques SET estado = 'Borrador' WHERE estado = 'Cotización'` (afecta 1 fila hoy).
- Registrar el cambio en `bitacora_actividad` con motivo "Eliminación estado Propuesta v13.303.21".

### 2. Máquina de estados (migración schema)
Reemplazar la función que valida transiciones (`20260718214722_...`) para que:
- `Borrador → Confirmado` (transición directa nueva).
- Eliminar `Borrador → Cotización` y `Cotización → *`.
- Si algún registro llega con `estado = 'Cotización'` (edge case), permitir sólo `→ Borrador` o `→ Confirmado` como salida de rescate.

### 3. Constantes / helpers UI
- `src/features/embarques/constants/embarqueConstants.ts`: quitar `'Cotización'` de los arrays de orden (`ORDEN_ESTADOS`, stepper visual, filtros por defecto).
- `src/features/embarques/constants/estadoEmbarqueLabels.ts`: eliminar el mapeo `Cotización → "Propuesta"` (ya no se muestra). Dejar helper `labelEstadoEmbarque` tolerante por si aparece dato viejo (fallback: "Propuesta (deprecado)").
- `AvanzarEstadoButton.tsx`: siguiente estado desde Borrador ahora es Confirmado.

### 4. Dashboards y parsers
- `src/features/dashboard/domain/parsers/dashboard.ts` + `dashboardTypes.ts`: quitar `Cotización` del conteo por estado (o mantener con 0 hasta la próxima limpieza — decidir en implementación por compat de gráficas).
- `src/lib/ui/estadoConfig.ts`: quitar entrada `Cotización` de la config visual.

### 5. Tests
- `src/features/embarques/constants/__tests__/estados-embarque-sync.test.ts`: ajustar snapshot.
- `src/features/dashboard/domain/parsers/__tests__/dashboard.test.ts`: recalcular llaves esperadas.
- `src/features/dashboard/hooks/__tests__/useDashboardController.test.tsx`: igual.
- Nuevo test unitario: `Borrador → Confirmado` es transición válida; `Borrador → Cotización` es inválida.

### 6. Documentación / versión
- Bump `APP_VERSION` a `13.303.21`.
- Entrada en `CHANGELOG.md` explicando el cambio y la migración del embarque afectado.

## Fuera de alcance (explícito)

- **No** se elimina el valor `'Cotización'` del enum `estado_embarque` (deuda técnica documentada).
- **No** se tocan RPCs de conversión COT→Embarque; el embarque nace en `Borrador` como hoy.
- **No** se modifica el módulo de Cotizaciones (documento comercial COT-XXXX).

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Reportes históricos que agrupan por `Cotización` | Se mantiene la llave con conteo 0; sin ruptura visual. |
| Código externo que aún escriba `Cotización` | La máquina de estados en BD rechaza la transición. |
| Snapshots/tests con el estado viejo | Actualizados en esta misma entrega. |

## Verificación post-implementación

1. `bun run lint -- --max-warnings 0`
2. `bunx vitest run` (particular atención a dashboard y estados).
3. Manual: abrir un embarque en Borrador → botón dice "Avanzar a Confirmado".
4. Query: `SELECT COUNT(*) FROM embarques WHERE estado = 'Cotización'` debe devolver 0.
