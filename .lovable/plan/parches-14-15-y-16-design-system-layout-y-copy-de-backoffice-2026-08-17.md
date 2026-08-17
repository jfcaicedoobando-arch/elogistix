# Parches 14, 15 y 16 — Design system, layout y copy de backoffice

Tres lotes de mejoras visuales y de texto. No cambian lógica de negocio, APIs ni base de datos.

## Qué se aplica

### Parche 14 — Adopción del design system (101 archivos)
- Estados de error con botón "Reintentar" en 36 pantallas que hoy, si falla la carga, muestran un "no hay datos" engañoso.
- Nuevo componente `Spinner` con 3 tamaños fijos y normalización de ~34 spinners fuera de escala.
- KPIs con tipografía unificada (`text-kpi`) en Higiene, Idempotencia y portal del cliente.
- Sombras de marca (`shadow-overlay` / `shadow-raised`) en landing y en el diálogo de factura manual.
- `transition-all` reemplazado por transiciones dirigidas en 14 archivos (barras de progreso, textareas, cards).

### Parche 15 — Layouts de backoffice (6 archivos)
- Card "Gastos fijos cubiertos" ya no se corta en el borde derecho.
- Card "Riesgo financiero pendiente" se compacta cuando no hay fugas.
- "Margen por modo" muestra "—" y la nota "Sin operaciones en el mes" en lugar de un 0.0% desbalanceado.
- "Desempeño por operador" omite la gráfica apilada cuando hay un solo operador y aclara en el subtítulo que incluye finalizados.
- Tabs del detalle de embarque y menú lateral con barra de scroll delgada visible como pista de que hay más contenido.

### Parche 16 — Copy es-MX de backoffice (6 archivos)
- Menú "Sentry" → "Monitoreo" (misma ruta e icono).
- Pantalla "Sin acceso": deja de mostrar la ruta cruda `(/admin)` y, para secciones internas de Libre Carga, dice que es exclusiva del equipo y hay que contactar a soporte (en vez de "pide a un administrador", contradictorio cuando el usuario ya es administrador).
- "Tu cuenta tenant" → "Tu organización"; el plan se muestra capitalizado ("Pro").
- Filtros de costeo: "Aprob:" → "Aprobación:", "Cont:" → "Contenedor:".
- Papelera: se quita el tecnicismo "(soft delete)".
- Banner Incoterm sin el espacio antes de los dos puntos ("Embarque CIF :").

## Detalles técnicos

- Se aplicarán con `patch -p1` en orden 14 → 15 → 16.
- **Conflictos ya detectados** (el repo evolucionó desde la base de los parches) y su resolución manual:
  - `src/components/layout/AppSidebar.tsx` (parche 15, VT-24): el hunk falla por contexto; se añadirá a mano la clase de scrollbar fino en `SidebarContent`.
  - `src/features/auth/routes/SinAcceso.tsx` (parche 16, VB-09): el archivo ya fue refactorizado (`resolveSinAccesoVariant`, `esRolAdministrador`, `SinAccesoMensaje`), así que el copy se ajustará dentro de esa estructura en vez de aplicar el hunk original.
- Los hunks del parche 14 aplican con offsets (uno con fuzz 1); se revisará el resultado en `CosteoTarifas.tsx`, `Oportunidades.tsx` y los hooks con passthrough `isError`/`refetch`.
- Verificación posterior: typecheck, ESLint (incluye los guardrails del design system), build, suite de tests y `bun run audit:all`.
- Se registrará en `CHANGELOG.md` y se subirá `APP_VERSION` a **13.641.0**.

## Fuera de alcance

- La migración masiva a `MoneyCell` (~110 archivos) y la adopción total de `Spinner` (~79 archivos) quedan como seguimiento, tal como indican los README.
- No se tocan primitivas `src/components/ui/*` con `transition-all`/`shadow-md` de shadcn.
