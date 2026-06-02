# Dashboard del Operador — Limpieza financiera + valor operativo

## Objetivo

Adaptar el dashboard principal (`/`) para que el rol **operador** vea solo información operativa, sin datos financieros de la empresa, y agregue widgets que apoyen su trabajo diario.

## Cambios

### 1. Bloqueo financiero total (operador)

Usar `usePermissions` (existe `role === "operador"`) para condicionar render.

- **Ocultar por completo:**
  - `ProfitTable` (tabla "Profit MXN — Arribos este mes")
  - En `ArribosCard`: tiles de Venta MXN / Costo MXN / Profit MXN (dejar Total / Ya llegaron / En camino)
  - En `EmbarquesActivosTable`:
    - Columnas: Profit MXN, Facturado
    - KPI tiles: Venta MXN, Costo MXN, Profit MXN, Facturados (dejar solo "Embarques: N")

- Admin / super_admin / vendedor → siguen viendo todo igual.

### 2. Tabs "Todos / Míos" en el dashboard

Tab bar arriba del contenido (debajo del `PageHeader`). Por defecto **Todos**.

- **Todos**: comportamiento actual (sin financieros si es operador).
- **Míos**: filtra todas las listas (`alertasDemora`, `proximosArribos`, `embarquesMesSiguiente`, `cargasPorCliente`, conteo por estado, etc.) por `embarque.operador === currentUser.nombre/email`.

Filtrado en cliente sobre los datos que ya devuelve `useDashboardData`. No cambia RPCs.

### 3. Tres widgets nuevos (operativos, sin $)

Nueva sección "Mi operación" visible solo para operador (y admin si quiere monitor):

- **Mis pendientes hoy** — embarques asignados al usuario con acciones pendientes detectadas:
  - Falta confirmar arribo (ETA ≤ hoy y estado aún En Tránsito)
  - Falta evento de tracking del día
  - Documentación incompleta
  
- **Docs faltantes** — conteo + lista corta de embarques activos del operador con documentos faltantes (reutilizar la lógica del badge "Docs Alert" ya existente — ver `mem://features/shipment-docs-alert`).

- **Sin tracking reciente** — embarques En Tránsito / En Aduana sin nuevo evento de tracking en los últimos N días (default 3).

Cada card: header con icono + título + contador, lista compacta de máx. 5, link "Ver todos".

## Detalle técnico

- `src/pages/dashboard/Dashboard.tsx`: agregar `usePermissions`, `useState` para tab activo (`"todos" | "mios"`), condicionar render de `ProfitTable` por `!isOperador`, pasar `scope` a los componentes que lo necesiten, montar nueva sección `<MiOperacionSection />` cuando `isOperador`.
- `src/components/dashboard/ArribosCard.tsx`: prop `hideFinancials?: boolean` — oculta los 3 tiles de $.
- `src/components/dashboard/EmbarquesActivosTable.tsx`: prop `hideFinancials?: boolean` — filtra columnas (`columns.filter(c => !["profit","facturado"].includes(c.id))`) y oculta tiles de $.
- Nuevo `src/components/dashboard/operador/MiOperacionSection.tsx` (≤200 líneas) con 3 sub-cards. Si crece, separar cada widget en su propio archivo.
- Nuevo hook `src/hooks/dashboard/useDashboardOperador.ts` que consulta:
  - embarques activos del operador con flags `tracking_atrasado`, `docs_incompletos`, `arribo_pendiente`
  - reutilizar selects existentes; servicio en `src/services/dashboard/operador.ts`
- Filtro Tab "Míos": en el hook actual o memos del `Dashboard.tsx`, filtrar por `e.operador`. Identificar al usuario actual vía `useAuth().profile?.nombre_completo` (verificar campo exacto al implementar).

## Versión y changelog

- Bump `APP_VERSION` a **12.50.0** (nueva feature, no patch).
- Entrada en `CHANGELOG.md` describiendo: bloqueo financiero para operador, tabs Todos/Míos, widgets Mis pendientes / Docs faltantes / Sin tracking reciente.

## Fuera de alcance

- Cambios en RLS o RPCs (los datos ya están disponibles).
- Dashboard ejecutivo / Profit (esos no los ve el operador).
- Cambios en sidebar u otras rutas.
