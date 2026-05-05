## Objetivo

En `/operaciones`, dentro de cada tarjeta de operador se muestra el desglose por estado (Confirmado, En Tránsito, Llegada, En Proceso, Cerrado). Hoy es solo informativo. Lo haremos clickeable: al dar click en un estado se abre un panel con la lista detallada de los embarques de ese operador en ese estado, con datos clave y enlace al detalle de cada embarque.

## Alcance

1. Hacer clickeable cada renglón de estado en `OperadorCard` (también en el desglose por cliente dentro de `ClienteExpandible`, opcional).
2. Mostrar un **Dialog** (modal) con la lista de embarques filtrados por: operador + estado real (calculado igual que el RPC: estado real considerando ETD/ETA/estado de DB).
3. Cada renglón del listado mostrará: expediente, cliente, modo/tipo, ruta (origen → destino), ETD, ETA, estado real, días en puerto / días para arribo, y un botón "Ver detalle" que navega a `/embarques/:id`.
4. Botón secundario "Ver todos en Embarques" que lleva a `/embarques` con filtros pre-aplicados (operador + estado) usando query string.
5. Mantener la lógica server-side: añadir el detalle de embarques por operador+estado en el RPC `operaciones_stats` para evitar nuevas llamadas.

## Diseño

```text
┌──── Tarjeta operador (Valeria) ─────────┐
│ ● Confirmado            8  ▸ (click)    │
│ ● En Tránsito           5  ▸            │
│ ● Llegada               3  ▸            │
│ ● En Proceso            2  ▸            │
│ ● Cerrado              12  ▸            │
└──────────────────────────────────────────┘
       │ click
       ▼
┌──── Dialog: Valeria · En Tránsito (5) ──────────────────┐
│ Buscar: [_____________]                                 │
│ ┌──────────────────────────────────────────────────────┐│
│ │ EXP-1234  Acme Corp   FCL/IMPO   SHA → MZL          ││
│ │ ETD 12/04  ETA 02/05  En Tránsito · 8 días para ETA ││
│ │                                       [Ver detalle] ││
│ └──────────────────────────────────────────────────────┘│
│ …                                                       │
│ [Ver todos en Embarques]              [Cerrar]          │
└─────────────────────────────────────────────────────────┘
```

Hover sobre el renglón de estado: fondo `bg-muted/40`, cursor pointer, ChevronRight a la derecha. Estados con `count = 0` no son clickeables (opacidad 60%, sin handler).

## Detalles técnicos

### Backend (migración SQL)

Actualizar `operaciones_stats()` para incluir, dentro de cada operador, un nuevo campo `embarquesPorEstado` con un objeto:

```json
{
  "Confirmado":  [ { id, expediente, cliente_nombre, modo, tipo, origen, destino, etd, eta, estadoReal, diasEnPuerto, diasParaEta } ],
  "En Tránsito": [ ... ],
  "Llegada":     [ ... ],
  "En Proceso":  [ ... ],
  "Cerrado":     [ ... ]
}
```

- Origen/destino derivados igual que el resto del proyecto: `puerto_origen` / `aeropuerto_origen` / `ciudad_origen` (CASE por modo) — preferir el primero no-null en el orden Port > Airport > City.
- `diasEnPuerto` solo aplica a `Arribo/En Aduana`; `diasParaEta` solo a `En Tránsito` (puede ser negativo).
- Para evitar payloads gigantes, tope de `LIMIT 200` por estado y operador, ordenado por ETA asc nulls last; si hay más, se incluye `truncated: true` y el dialog mostrará un aviso "Mostrando primeros 200 de N — usar 'Ver todos en Embarques'".
- `Cerrado` puede ser muy grande: limitar a últimos 50 ordenados por `fecha_llegada_real` desc.

### Tipos y servicio

- `src/services/operaciones/index.ts`: añadir interface `EmbarqueResumen` y campo `embarquesPorEstado: Record<EstadoKey, EmbarqueResumen[]>` en `ServerOperador`.
- `src/hooks/operaciones/useOperacionesData.ts`: pasar el campo tal cual al `OperadorData`.

### UI

- Nuevo componente `src/components/operaciones/EmbarquesEstadoDialog.tsx`:
  - Props: `open`, `onOpenChange`, `operador: string`, `estado: EstadoKey`, `embarques: EmbarqueResumen[]`, `truncated?: boolean`.
  - Usa `Dialog` de shadcn, `Input` para búsqueda local (filtra por expediente / cliente), lista renderizada con renglones compactos.
  - Acciones: `Link` a `/embarques/:id` por renglón; botón "Ver todos en Embarques" → `navigate('/embarques?operador=<>&estado=<>')`.
- `OperadorCard.tsx`: convertir cada renglón de estado en `<button>`; estado seleccionado controlado por `useState<EstadoKey | null>`. Solo estados con `count > 0` son clickeables.
- (Opcional, fase 2) `ClienteExpandible.tsx`: hacer clickeables también los desgloses por cliente — mismo dialog filtrado adicionalmente por cliente. **Excluido de esta entrega** para mantener el cambio acotado; lo dejamos planteado.

### Pre-filtros en `/embarques`

`Embarques.tsx` actualmente NO lee query params. Añadir un pequeño `useEffect` en `useEmbarquesPageController` (o en la página) que al montar lea `searchParams` y llame `setFilterEstado` / `setFilterOperador` si vienen presentes. Valores aceptados:

- `?estado=Confirmado|En%20Tránsito|Llegada|En%20Proceso|Cerrado`
- `?operador=<nombre>`

Sin romper el comportamiento actual cuando no hay params.

### Cambios en archivos

- `supabase/migrations/<nuevo>.sql` — recrear `operaciones_stats()` con `embarquesPorEstado`.
- `src/services/operaciones/index.ts` — tipos.
- `src/hooks/operaciones/useOperacionesData.ts` — propagar.
- `src/components/operaciones/OperadorCard.tsx` — clickeable + estado local + dialog.
- `src/components/operaciones/EmbarquesEstadoDialog.tsx` — nuevo.
- `src/pages/embarques/Embarques.tsx` (o controller) — leer query params.
- `src/constants/appVersion.ts` + `src/content/changelogData.ts` + `src/content/changelog/v8/chunks/0.ts` — bump a **v8.117.5** y entrada de changelog.

## Fuera de alcance

- Drill-down a nivel cliente (puede ser fase 2).
- Cambio del comportamiento del gráfico de barras apiladas (seguirá no-interactivo).
- Edición/acciones masivas desde el dialog.

## Pregunta

¿OK con abrir un **Dialog modal** sobre la misma página, o prefieres que el click navegue directamente a `/embarques` con los filtros pre-aplicados (sin modal)?
