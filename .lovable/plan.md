## Objetivo

Isela (rol contador / tesorero / cobranza / auxiliar contable) no tiene "Embarques" en su menú lateral porque su perfil financiero no lo incluye por diseño. Le agregaremos visibilidad de los embarques **Entregado** y **EIR** desde su `/inicio` mediante una tarjeta de KPIs **de sólo lectura** (sin abrir el módulo Embarques).

## Alcance

Sólo cambios de UI en el dashboard. No se modifican rutas, permisos, RLS, ni el módulo `/embarques`.

## Qué se agrega

Nueva tarjeta `EmbarquesPendientesAdminCard` visible **únicamente** para los roles financieros (`contador`, `tesorero`, `ejecutivo_cobranza`, `auxiliar_contable`). La tarjeta tiene dos KPIs:

```text
┌──────────────────────────────────────────────────┐
│ Embarques pendientes administrativos             │
├──────────────────────┬───────────────────────────┤
│   Entregados   12    │   En EIR        5         │
│   (esperan cierre)   │   (último paso marítimo)  │
├──────────────────────┴───────────────────────────┤
│ Top 10 más antiguos:                             │
│  • LC-2410-0123  ACME S.A.   Entregado · 18 d    │
│  • LC-2410-0098  Beta Corp   EIR        · 22 d   │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

Cada fila muestra: folio, cliente, estado (badge) y días en ese estado. **No** hay link a `/embarques/:id` (rol sin acceso); el contenido es informativo para que sepa qué reclamar a operaciones.

## Dónde encaja

- `src/features/dashboard/routes/Dashboard.tsx`: insertar la nueva tarjeta justo después de `DashboardStatusCards` cuando `effectiveRole` sea uno de los roles financieros.
- `src/features/dashboard/components/EmbarquesPendientesAdminCard.tsx` (nuevo): UI de la tarjeta.
- `src/features/dashboard/hooks/useEmbarquesPendientesAdmin.ts` (nuevo): `useQuery` que llama a Supabase con `select` mínimo (`id, folio, estado, fecha_entrega_real, fecha_eir, cliente:clientes(nombre_comercial)`) filtrando `estado in ('Entregado','EIR')` y ordenando por antigüedad. Limita a 10 filas + `count: 'exact'` para los totales.

## Detalles técnicos

- Se reutiliza el patrón de selección explícita de columnas (regla del proyecto sobre query optimization).
- Cálculo de "días en estado" en utilitario puro (regla de date-time standards, UTC).
- Sin `useEffect`, sólo React Query con `staleTime: 5 min` (igual que `useSidebarAlerts`).
- Componente <200 líneas, sin `any`, con cleanup implícito vía React Query.
- Bump `APP_VERSION` y entrada en `CHANGELOG.md` (`## [13.89.6] - 2026-06-21`).

## Lo que NO se hace

- No se habilita `/embarques` para roles financieros.
- No se agrega un nuevo item al sidebar.
- No se tocan RLS ni se crean RPCs nuevas (la query usa la tabla `embarques` con el RLS existente, que ya permite SELECT a estos roles dentro de su organización).
