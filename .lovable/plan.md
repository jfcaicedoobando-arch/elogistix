# Embudo comercial con criterios de salida y metas por oportunidad

Hoy `/crm/oportunidades` ya tiene Kanban con arrastre entre etapas, probabilidad heredada y prompt de "próximo paso". Falta lo que el equipo comercial usa en su Excel: **qué debe cumplirse para avanzar de etapa** y **la meta de monto/fecha de cada oportunidad**. Todo se integra en el Kanban actual (sin pestaña nueva) y el incumplimiento **sólo advierte**, nunca bloquea.

## 1. Criterios de salida por etapa

Cada etapa del pipeline podrá definir su propio checklist (ej. "ICP validado", "dolor confirmado", "cotización enviada", "decisor identificado"). Se administra en CRM > Configuración > Etapas del pipeline: agregar, renombrar, ordenar, activar/desactivar y marcar cuáles son obligatorios.

En cada oportunidad, el checklist de su etapa actual se marca como cumplido/pendiente (con quién y cuándo lo marcó). En el Kanban:

- La tarjeta muestra un indicador compacto tipo `3/5 criterios` con color: verde completo, ámbar incompleto.
- Al arrastrar a otra etapa con criterios pendientes aparece un aviso ("Faltan 2 criterios de Calificación") con opción de continuar; el movimiento se registra en la bitácora indicando que se avanzó con pendientes.
- Panel de detalle de la oportunidad: sección "Criterios de salida" con casillas para marcarlos.

## 2. Meta de monto y fecha de cierre por oportunidad

Se agregan a la oportunidad: **monto meta**, **fecha meta de cierre** y (opcional) **nota de compromiso**. Con eso:

- La tarjeta compara estimado vs meta (barra corta y `%`) y avisa si la fecha meta ya pasó sin cierre.
- El encabezado de cada columna del Kanban suma: número de oportunidades, monto estimado, monto meta y ponderado por probabilidad.
- Una franja superior del pipeline resume: total estimado, total meta, ponderado y avance contra la suma de metas.

Los campos son opcionales: si no hay meta, la tarjeta se ve igual que hoy.

## 3. Flujo en pantalla (Kanban enriquecido)

```text
Pipeline   Estimado $4.2M | Meta $5.0M | Ponderado $1.8M | Avance 84%
┌ Prospección ─────┐ ┌ Calificación ────┐ ┌ Propuesta ───────┐
│ 6 · $900k        │ │ 4 · $1.4M        │ │ 3 · $1.9M        │
│ meta $1.1M       │ │ meta $1.5M       │ │ meta $2.4M       │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ Acme Granos      │ │ Ferretera Bajío  │ │ Textiles MX      │
│ $320k · 20%      │ │ $500k · 40%      │ │ $700k · 60%      │
│ ▮▮▮▮▯ 4/5        │ │ ▮▮▯▯▯ 2/5 ⚠      │ │ ▮▮▮▮▮ 5/5        │
│ meta 30/09 · 91% │ │ meta 15/09 ⚠     │ │ meta 31/10       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Detalles técnicos

Base de datos (una migración):
- `crm_etapa_criterios`: `etapa_id`, `nombre`, `orden`, `obligatorio`, `activo`, `organization_id`, timestamps + RLS por organización y GRANTs.
- `crm_oportunidad_criterios`: `oportunidad_id`, `criterio_id`, `cumplido_at`, `cumplido_por`, único por par; RLS + GRANTs.
- `crm_oportunidades`: nuevas columnas `monto_meta numeric`, `fecha_meta_cierre date`, `compromiso_nota text`.
- RPC `crm_criterios_avance(p_oportunidad_ids uuid[])` que devuelve cumplidos/total/obligatorios pendientes por oportunidad, para no hacer N consultas desde el Kanban.

Frontend:
- `services/criteriosEtapa.ts` (+ query keys en `queryKeys.ts`) y hooks `useCriteriosEtapa`, `useAvanceCriterios`, `useMarcarCriterio`.
- `domain/criterios.ts` puro: cálculo de avance, semáforo y comparación estimado vs meta (con pruebas unitarias, sin `any`).
- `OportunidadKanban.tsx` se divide para respetar el límite de 200 líneas: `kanban/OportunidadCard.tsx`, `kanban/ColumnaEtapa.tsx`, `kanban/PipelineMetasBar.tsx`.
- Aviso al mover: se extiende `useMoverOportunidadEtapa` para advertir criterios pendientes antes de confirmar, reutilizando `notifyWarning`.
- `EtapasPipelineEditor.tsx` gana un sub-editor de criterios por etapa; `NuevaOportunidadDialog` y el detalle capturan monto meta y fecha meta con `DatePickerMx`.
- Formatos es-MX y moneda con los helpers existentes; nada de colores fuera de tokens.

Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
