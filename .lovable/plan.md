## Módulo de Auditoría Operativa

Página `/auditoria` que recalcula en vivo las inconsistencias entre documentos, estados y fechas de los embarques de la organización (todos excepto `Cancelado`). Sin cron ni emails: el reporte se construye al abrir la página y un badge en el sidebar muestra el total de pendientes.

### Reglas de detección

**1. Documentos faltantes según estado del embarque**

Matriz de documentos exigidos por etapa (los nombres ya existen en `documentos_embarque.nombre`):

| Estado del embarque | Documentos exigidos |
|---|---|
| Confirmado | Factura Comercial, Packing List |
| En Tránsito | + BL Master, BL House (marítimo) ó AWB (aéreo) |
| En Aduana / Arribo / Llegada | + Certificado de Origen, Ficha Técnica |
| En Proceso / Entregado / Cerrado | Todos los anteriores + EIR (marítimo FCL) |

Marítimo vs aéreo se decide por `embarques.modo`. Falta = registro inexistente **o** registro con `archivo IS NULL`.

**2. Documentos en `Pendiente` con embarque avanzado**

Cualquier `documentos_embarque.estado = 'Pendiente'` cuando el embarque ya está en `En Aduana`, `Llegada`, `Entregado` o `Cerrado` → severidad alta.

**3. Estados inconsistentes con fechas**

- `En Tránsito` sin `etd` o con `etd` futura
- `Llegada` / `Arribo` sin `fecha_llegada_real`
- `Confirmado` con `eta` pasada hace ≥3 días
- `Entregado` / `Cerrado` sin `fecha_llegada_real`

**4. Conceptos de venta sin facturar en embarques cerrados**

Embarques en `Entregado` o `Cerrado` con al menos un `conceptos_venta.estado_facturacion = 'pendiente'`.

### Severidades

- **Crítico** (rojo): regla 2 y regla 4
- **Alto** (ámbar): documentos faltantes en estados ≥ "En Tránsito"
- **Medio** (azul): inconsistencias de fechas y faltantes en "Confirmado"

### Backend — RPC única

Nueva función `public.auditoria_embarques_org()` SECURITY INVOKER que respeta RLS y devuelve un JSONB:

```text
{
  generated_at, total_hallazgos,
  por_severidad: { critico, alto, medio },
  por_regla:    { docs_faltantes, docs_pendientes_avanzado, fechas, ventas_sin_facturar },
  hallazgos: [
    { embarque_id, expediente, cliente_nombre, modo, estado, eta,
      regla, severidad, detalle, documentos_faltantes[] }
  ]
}
```

Una sola llamada cubre la página completa y el badge del sidebar (lee `total_hallazgos`).

### Frontend

- **Ruta** `/auditoria` lazy-loaded en `App.tsx`, accesible para `admin`, `operador`, `viewer` (no clientes).
- **Entrada en el sidebar** dentro del grupo "Operación" con icono `ShieldAlert` y `Badge` rojo cuando `total_hallazgos > 0`.
- **Página** con:
  - 3 KPI cards arriba: Críticos, Altos, Medios.
  - 4 secciones colapsables (una por regla) con tabla `DataTable` estándar (zebra striping, densidad media): Expediente, Cliente, Estado, ETA, Detalle, acción "Abrir embarque" → `/embarques/:id`.
  - Filtros: por severidad y por modo (Marítimo/Aéreo/Terrestre).
  - Botón "Recalcular" que invalida la query.
- **Hook** `useAuditoria()` con React Query, `staleTime: 5 min`, key `["auditoria", organization_id]`.
- **Badge sidebar**: nuevo hook `useAuditoriaCount()` que comparte la misma query (mismo cache key) — cero round-trips extra.

### Arquitectura técnica

```text
DB:    auditoria_embarques_org() RPC  →  JSONB
       ├─ lee embarques + documentos_embarque + conceptos_venta filtrados por current_user_org_id()
       └─ aplica las 4 reglas en SQL (CTEs)

Hook:  useAuditoria  → supabase.rpc("auditoria_embarques_org")
Page:  /auditoria → KPIs + secciones colapsables
Side:  AppSidebar → Badge usa misma query, suma total_hallazgos
```

### Archivos a crear

- `supabase/migrations/<ts>_auditoria_rpc.sql` — función RPC
- `src/hooks/auditoria/useAuditoria.ts`
- `src/pages/Auditoria.tsx`
- `src/components/auditoria/HallazgoTabla.tsx`
- `src/components/auditoria/AuditoriaKpis.tsx`

### Archivos a editar

- `src/App.tsx` — registrar ruta lazy
- `src/components/layout/AppSidebar.tsx` — entrada + badge dinámico
- `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` — entrada v8.99.47 (minor)

### Lo que NO incluye este plan

- Cron diario, snapshots históricos en `auditoria_reportes`, emails al admin (descartado en la pregunta 2).
- Edición de las reglas desde UI: la matriz de documentos por estado vive en SQL como CTE; cambiarla requiere migración. Si después quieres hacerla editable, se mueve a `configuracion`.
