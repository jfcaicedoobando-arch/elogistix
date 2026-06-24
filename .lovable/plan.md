# Rediseño del indicador de organización en el sidebar

## Problema observado
En la captura del sidebar, el `OrgBadge` ("Chino Cochino") aparece como una caja con borde, fondo `bg-sidebar-accent/30`, icono y misma altura (`h-8`) que los items del menú. Resultado: **parece un botón/módulo navegable** y compite visualmente con "Principal", "Operaciones", etc.

## Objetivo
Que se lea claramente como **"estás trabajando en esta organización"** (contexto), no como un destino navegable.

## Cambio propuesto (solo UI, archivo `src/components/layout/OrgBadge.tsx`)

Reemplazar el "chip con borde" por una **etiqueta de contexto** estilo encabezado:

- Sin borde, sin fondo de acento, sin look de botón.
- Texto pequeño con `uppercase`, tracking amplio, color tenue (`text-sidebar-foreground/50`) arriba — etiqueta "Organización".
- Debajo, el nombre de la organización en `text-sm font-semibold text-sidebar-foreground` con `truncate`.
- Icono `Building2` opcional, pequeño y tenue, al lado del nombre.
- Padding horizontal mínimo, sin altura fija que lo iguale a los items.
- Sin `cursor-pointer`, sin `hover:` de fondo (es read-only).

Estado colapsado: mantener solo el icono `Building2` centrado con tooltip (igual que hoy), pero sin fondo de acento.

```text
┌─────────────────────────┐
│ ORGANIZACIÓN            │  ← caption tenue, uppercase, 10px
│ 🏢 Chino Cochino        │  ← nombre, semibold, sm
├─────────────────────────┤
│ DASHBOARDS              │
│   Principal             │
└─────────────────────────┘
```

Lo mismo aplica al `OrgSwitcher` cuando el super admin lo ve: cambiar el `Button variant="outline"` por un trigger más sutil (texto + chevron pequeño) para que no compita con los items de menú. Mantiene su funcionalidad de cambio de organización.

## Versionado
- `src/constants/appVersion.ts` → `13.135.21`
- `CHANGELOG.md` → entrada `13.135.21`: "Sidebar: el nombre de la organización ahora se muestra como etiqueta de contexto en lugar de botón, para no confundirse con un módulo navegable."

## Archivos a tocar
- `src/components/layout/OrgBadge.tsx` (rediseño visual)
- `src/components/layout/OrgSwitcher.tsx` (alinear el trigger no-colapsado al mismo lenguaje sutil)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Analogía
Hoy el nombre de la organización está vestido igual que los botones del menú — como un empleado con el mismo uniforme que los meseros, la gente le pide la cuenta. Lo vamos a vestir como un **letrero de "Sucursal: Centro"** colgado en la pared: claro, informativo, pero nadie intenta tocarlo esperando que abra algo.
