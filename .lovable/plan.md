# Plan: Desglose accionable de alertas en /embarques

## Problema

El badge del sidebar "Embarques · 21" suma tres conteos que hoy no se ven en ningún lado de la lista:

```
embarquesAlertas = embarquesDemora      // contenedores con demora real o por ETA
                 + garantiasAtoradas    // garantías de contenedor sin liberar
                 + adminPendientes      // embarques Entregado/EIR con cierre admin pendiente
```

Cuando Héctor (Admin Org) entra a `/embarques`, sólo ve la tabla paginada general. No hay forma de saber qué embarques están detrás de ese 21 ni qué acción tomar.

## Objetivo

Que al entrar a `/embarques` el usuario vea: cuántas alertas hay, de qué tipo, y pueda filtrar la tabla con un clic para atenderlas.

## Cambios

### 1. Nuevo panel "Alertas activas" arriba de la tabla

Una tarjeta colapsable (abierta por defecto si `totalAlertas > 0`) con 3 chips/KPIs:

```text
┌──────────────────────────────────────────────────────────────┐
│  Alertas activas · 21                            [Ocultar ▲] │
├──────────────────────────────────────────────────────────────┤
│  🟠 Demoras           12   ▶ Ver embarques con demora        │
│  🟡 Garantías         4    ▶ Ver garantías atoradas          │
│  🔴 Cierre admin      5    ▶ Ver pendientes administrativos  │
└──────────────────────────────────────────────────────────────┘
```

Cada chip es un botón que aplica un filtro predefinido a la tabla y hace scroll a ella.

### 2. Filtros nuevos en la URL/estado de `/embarques`

Agregar parámetro `alerta` (`demora` | `garantia` | `admin_pendiente`) que el listado consume para filtrar resultados. Se respeta junto con los filtros actuales (cliente, modo, rango de fechas).

- `alerta=demora` → embarques con contenedores marcados en demora.
- `alerta=garantia` → embarques con garantías de contenedor sin liberar.
- `alerta=admin_pendiente` → embarques en estado `Entregado` o `EIR` con pendientes (la lógica ya existe en `fetchEmbarquesPendientesAdmin` y `embarque_admin_pendientes_resumen`).

### 3. Columna/badge "Alerta" en la tabla

Cuando hay un filtro de alerta activo, aparece una columna que dice por qué entró ese embarque al filtro (reutilizando `EmbarqueBadgeAdmin` y un badge nuevo para demora/garantía). Tooltip con el detalle (días en demora, contenedor afectado, etc.).

### 4. Chips activos

Si `alerta` está aplicado, aparece un chip removible en `EmbarquesFiltrosChips` ("Alerta: Demoras ×") para que el usuario sepa qué está filtrando.

## Detalles técnicos

- **Servicio**: extender `fetchEmbarquesPaginados` para aceptar `filterAlerta` y traducirlo a las condiciones SQL existentes (joins ya disponibles vía `embarques_listado` RPC o filtros sobre `estado` + `embarque_admin_pendientes_resumen`).
- **Hook nuevo** `useEmbarquesAlertasResumen` que reúne los 3 conteos (puede simplemente reusar `useSidebarAlerts` para no duplicar queries).
- **Componente nuevo** `src/features/embarques/components/EmbarquesAlertasPanel.tsx` (<200 líneas, Power of 10).
- **Estado de la página**: añadir `filterAlerta` al `useListPageState` existente de `/embarques` y sincronizar con query param `?alerta=`.
- Sin cambios de schema; toda la data ya existe (`embarque_admin_pendientes_resumen`, `garantiasAtoradas`, `embarquesDemora`).
- Tests: snapshot del panel, test de filtro `?alerta=demora` aplica el predicado correcto, test de chip removible.

## Fuera de alcance

- Bandeja dedicada `/embarques/alertas` separada (se puede hacer después si crece).
- Notificaciones por email/escalamiento.
- Cambiar la lógica de qué cuenta como alerta (se respetan las reglas actuales).

## Bump de versión

`13.142.3` + entrada en `CHANGELOG.md`.
