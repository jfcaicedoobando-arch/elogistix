# Architecture — Libre Carga

Guía corta de las capas y sus responsabilidades. **Mantener este contrato evita acoplamientos y simplifica los tests.**

## Capas

```
src/
├── pages/          → Composición de UI por ruta. NO tocan Supabase ni lógica de dominio.
├── components/     → Componentes reutilizables y específicos de feature.
├── hooks/          → React Query + estado local + side effects (toasts, navegación).
│   ├── cotizacion/     → Hooks específicos del dominio de cotizaciones.
│   ├── embarque/       → Hooks específicos del dominio de embarques.
│   └── *.ts            → Hooks transversales (auth, permisos, dashboard, clientes, etc.).
├── services/       → Acceso puro a datos (Supabase, edge functions, fetch). Sin React Query.
├── lib/            → Utilidades puras y reutilizables.
│   ├── domain/         → Reglas de dominio (cálculos de estado, validaciones).
│   ├── mappers/        → Transformación entre formato DB ↔ UI.
│   ├── parsers/        → Parsing de payloads (CSF, dashboard).
│   └── *.ts            → formatters, errorUtils, queryKeys, etc.
├── data/           → Datasets estáticos (changelog, seeds, ports).
├── constants/      → Constantes de dominio/UI (cotización, embarque, proveedor, wizard).
├── types/          → Tipos compartidos entre módulos.
├── contexts/       → React Contexts (Auth, Organization).
├── generators/     → Generación de archivos (PDF, CSV).
└── integrations/   → Clientes auto-generados (Supabase). NO editar.
```

> **Convención de hooks de dominio**: los consumidores externos importan siempre desde los barrels `@/hooks/useCotizaciones` y `@/hooks/useEmbarques`. Los archivos individuales bajo `hooks/cotizacion/` y `hooks/embarque/` son detalle de implementación — solo se importan directamente cuando exponen una API que no pasa por el barrel (ej. `useCotizacionWizardForm`, `useEmbarqueDetalleActions`).

## Reglas

### 1. Pages NO tocan Supabase
Toda lectura/escritura debe pasar por un hook (`useEmbarque`, `usePrefetchEmbarque`, etc.) o un service.

❌ Mal:
```tsx
// src/pages/Embarques.tsx
const { data } = await supabase.from('embarques').select('*');
```

✅ Bien:
```tsx
// src/pages/Embarques.tsx
const { data } = useEmbarques();
```

### 2. Hooks vs Services

| | Service | Hook |
|---|---------|------|
| Responsabilidad | Acceso a datos puro | Orquestación de UI |
| React Query | ❌ no | ✅ sí (`useQuery`/`useMutation`) |
| Toasts/navegación | ❌ no | ✅ sí |
| Reutilizable fuera de React | ✅ sí | ❌ no |

Un service expone funciones async simples. Un hook envuelve uno o más services con cache, invalidación y feedback al usuario.

### 3. Componentes UI shadcn — read-only
Los archivos en `src/components/ui/` son shadcn intactos. **No editarlos**; si necesitas variar comportamiento, crea un wrapper.

### 4. Localización
Dominio de negocio en español (`useNavieras`, `Cotizaciones.tsx`). Utilidades técnicas en inglés (`useDebounce`, `formatters.ts`).

### 5. Datos sensibles
Nunca poner secrets en cliente. Las edge functions usan service-role; la UI usa la anon key.

## Cuándo crear un service nuevo
- La UI necesita llamar a una edge function (ej. `trackingService`).
- Existe lógica de transformación de payload no trivial.
- Múltiples hooks comparten el mismo acceso a datos.

## Cuándo NO crear un service
- El acceso es trivial (`.from('x').select(...)` directo) y vive en un solo hook.
- Sería un wrapper 1:1 sin valor.

## Transacciones complejas → RPC en Supabase

Cuando una operación implica **múltiples escrituras dependientes** (insertar cabecera + N detalles, snapshots consolidados, encadenar facturación con conceptos), debe implementarse como una **función RPC** en `supabase/migrations/` y consumirse vía `supabase.rpc('nombre_funcion', { ... })` desde el service.

**Por qué**: los rollbacks manuales en JS (try/catch + delete del registro padre) no son atómicos. Si el cliente pierde la red entre dos pasos, la base queda en estado inconsistente. Una función RPC corre en una sola transacción de Postgres y garantiza atomicidad real.

**Patrón**:
1. Migración SQL define `create or replace function public.<accion>(...) returns ... language plpgsql security definer`.
2. `services/<dominio>Services.ts` expone una función async que invoca `supabase.rpc(...)`.
3. El hook (`useMutation`) solo orquesta cache e invalidaciones.

Ejemplos canónicos en el repo: `crear_proforma_con_conceptos`, `consolidar_proformas`, `eliminar_embarque_cascada`.

## Deuda técnica aceptada (auditoría v8.36.0)

- **Hooks Detalle fragmentados**: `useCotizacionDetalleState` + `useCotizacionDetalleHandlers` y `useEmbarqueDetalleActions` + `useEmbarqueEstadoActions` + `useEmbarqueDocumentosActions` mantienen su separación queries/mutations a propósito. Fusionarlos perjudicaría testabilidad sin reducir complejidad real.
- **Naming bilingüe**: regla #4 cubre el patrón es/en. No se renombran archivos existentes para evitar ruido en historial.
- **Re-exports `@/data/*`**: eliminados por completo en v8.36.0.
