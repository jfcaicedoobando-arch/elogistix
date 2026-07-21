# Perfil de Cliente como Single Source of Truth de Crédito

## Objetivo

Convertir el perfil del cliente en la fuente única para dos políticas comerciales:
- **Días de crédito** (ya existe el campo, pero se sobreescribe por operación).
- **Monto máximo de crédito en MXN** (nuevo).

Cuando se genere una proforma o factura, la app debe:
1. Tomar los días de crédito **siempre del cliente**, sin permitir editarlos por operación.
2. Sumar el saldo pendiente de facturas vigentes del cliente y, si al agregar la nueva operación se excede el límite, mostrar una confirmación explícita antes de continuar.

---

## Fase 1 · Base de datos

Migración a `public.clientes`:

- Nueva columna `limite_credito_mxn NUMERIC(14,2) NULL` — `NULL` = sin límite configurado (comportamiento actual).
- `dias_credito` se mantiene tal cual (`INTEGER NULL`), pero pasa a ser obligatorio a nivel de UX: sin días de crédito no se puede emitir a crédito.
- Nuevo RPC `public.get_exposicion_credito_cliente(p_cliente_id uuid)` (SECURITY DEFINER, filtrado por `organization_id`) que devuelve:
  - `saldo_pendiente_mxn`: suma de saldos de facturas vivas (`estado ∈ FACTURA_ESTADOS_VIVOS`) del cliente, convertidas a MXN al TC de la factura.
  - `limite_mxn`, `dias_credito`, `disponible_mxn`, `excedido` (bool).
- Índice parcial en `facturas(cliente_id, estado)` si aún no existe, para mantener rápido el cálculo.

Sin cambios a proformas/facturas: el límite se valida en app usando el RPC.

## Fase 2 · Perfil del cliente (UI)

En `DialogEditarCliente.tsx` y `NuevoClienteDialog.tsx`, agregar sección **"Condiciones de crédito"** con:

- **Días de crédito** (número, entero, 0–180). Requerido para operar a crédito.
- **Límite de crédito (MXN)** (moneda MXN). Vacío = sin límite.
- Nota inline: "Estos valores se aplicarán automáticamente a todas las proformas y facturas del cliente."

En la pantalla de detalle del cliente (`/clientes/:id`), nueva tarjeta **"Crédito"** que muestra:

```text
Días de crédito:     30 días
Límite:              $ 500,000.00 MXN
En uso:              $ 320,450.00 MXN  (64%)
Disponible:          $ 179,550.00 MXN
```

Con barra de progreso y color: verde <70%, ámbar 70–90%, rojo >90% o excedido.

## Fase 3 · Aplicación al emitir proforma/factura

- **Días de crédito** dejan de ser editables en el diálogo de proforma. Se muestran como lectura ("30 días — configurado en el perfil del cliente") con link "Editar en perfil". Si el cliente no tiene días configurados, se bloquea la acción con mensaje claro.
- **Al confirmar** emisión de proforma o factura, se llama al RPC de exposición. Si al sumar el monto MXN de la nueva operación se rebasa el límite:
  - Se abre `ConfirmActionDialog` con severidad `warning`: "Este cliente excederá su límite de crédito por $ X. ¿Deseas continuar?".
  - Al confirmar, se registra en `bitacora_actividad` con `accion="excede_credito"`.
- Si el cliente no tiene límite (`NULL`), no se valida nada — comportamiento actual intacto.

## Fase 4 · Visibilidad transversal (opcional en esta iteración)

- Badge "Crédito excedido" en la tabla de clientes y en el buscador global cuando `excedido = true`.
- Nueva columna opcional "Uso de crédito" en la tabla de clientes.

---

## Detalles técnicos

**Archivos que se tocan**
- Migración nueva bajo `supabase/migrations/…` con la columna y el RPC.
- `src/features/cliente/services/crud.ts` — extender tipos, `fetchCliente`, `updateCliente` y `fetchDiasCreditoCliente` → renombrar a `fetchCondicionesCreditoCliente`.
- `src/features/cliente/queryKeys.ts` — key `credito(id)`.
- Nuevo hook `useExposicionCreditoCliente(clienteId)` sobre el RPC.
- `src/features/cliente/components/DialogEditarCliente.tsx` y `NuevoClienteDialog.tsx` (+ `nuevoClienteValidators.ts`) — nueva sección + validación zod.
- Nuevo componente `src/features/cliente/components/detalle/TarjetaCredito.tsx`.
- `src/features/proformas/components/AccionesProforma.tsx` y `services/crud.ts` — quitar edición de días, disparar validación de límite.
- `src/features/proformas/services/facturar.ts` y `services/convertirAFactura.ts` — mismo control al facturar.
- Extender `SENSITIVE_FIELDS.cliente` con los dos campos nuevos para que queden en `bitacora_actividad`.

**Constantes / helpers reutilizados**
- `FACTURA_ESTADOS_VIVOS` para filtrar el saldo.
- `tcValido` + utilidades de `src/lib/financial/` para convertir facturas USD/EUR a MXN.
- `notifySuccess` / `notifyError` como toasts.

**Tests**
- Unit: cálculo de exposición con mezcla de monedas y con NC aplicadas.
- Integración: validador que dispara advertencia cuando se rebasa; que no dispara si `limite_credito_mxn IS NULL`.
- RLS: RPC solo devuelve datos del `organization_id` del usuario.

**Cambios de versión**
- Bump `APP_VERSION` (patch).
- Entrada en `CHANGELOG.md` describiendo la nueva política de crédito y el cambio en el diálogo de proforma.

## Fuera de alcance

- Múltiples monedas de límite (solo MXN).
- Bloqueo duro al exceder (solo advertencia con confirmación).
- Aging / recordatorios (ya viven en el módulo de cobranza y no se tocan).
- Cambiar el default de proforma para clientes sin días configurados (se pedirá capturarlos en perfil primero).
