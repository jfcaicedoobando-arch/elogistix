# Marcar clientes y embarques como "sin comisión"

Hoy la única forma de evitar una comisión es dejar el embarque sin vendedora, lo cual es ambiguo: no distingue "falta asignar" de "este negocio no paga comisión". El plan agrega una marca explícita en dos niveles: el cliente define el default y el embarque puede sobreescribirlo.

## Cómo se va a usar

1. **Cliente**: en el diálogo de editar cliente aparece una casilla **"Cuenta directa (no genera comisión)"**, junto a las condiciones de crédito.
2. **Embarque**: en el detalle del embarque, sección de comisión, aparece un selector con tres opciones:
   - *Heredar del cliente* (default)
   - *Sí genera comisión*
   - *No genera comisión*
3. **Comisiones → Configuración**: la lista "Embarques sin vendedora asignada" deja de mostrar los embarques excluidos, y muestra un contador aparte: *"N embarques excluidos de comisión"*. Así la lista de pendientes queda limpia y solo contiene lo que realmente falta asignar.
4. **Comisiones → Devengadas**: cuando se cobra una factura de un embarque excluido, ya no se crea el registro con nota "Sin vendedora asignada": simplemente no se genera comisión.
5. **Checklist de cierre del embarque**: los pasos de comisión pasan a **"No aplica"** (gris) en embarques excluidos, en lugar de quedar pendientes para siempre.

Sin captura de motivo: solo la casilla/selector.

Como el módulo de comisiones aún no se ha usado en producción, no hay comisiones históricas que reconciliar; la marca aplica desde el momento en que se activa.

## Detalles técnicos

**Base de datos (una migración)**
- `clientes`: nueva columna `sin_comision boolean not null default false`.
- `embarques`: nueva columna `sin_comision boolean null` (`null` = heredar del cliente, `true`/`false` = override explícito).
- Función `resolver_sin_comision(p_embarque_id uuid) returns boolean`: `COALESCE(embarques.sin_comision, clientes.sin_comision, false)`.
- `calcular_comision_pago(p_pago_factura_id uuid)`: al inicio, si `resolver_sin_comision(...)` es `true`, cancelar/omitir el devengo (no insertar fila nueva; si existiera una no liquidada, dejarla en `Cancelada` con nota "Embarque excluido de comisión") y salir.
- Sin cambios de RLS: ambas columnas viven en tablas ya protegidas; se reutilizan las policies de `UPDATE` existentes de `clientes` y `embarques`.

**Frontend**
- `src/features/cliente/components/CondicionesCreditoSection.tsx` (o sección nueva hermana): `Switch` para `sin_comision`; extender el tipo `ClienteData` en `DialogEditarCliente.tsx` y en el alta de cliente, más el `select` de columnas del servicio de clientes.
- `src/features/embarques`: exponer `sin_comision` en el detalle (tarjeta de comisión/vendedora) con el selector de 3 estados y su mutación; incluir la columna en las constantes de `select` y en `actualizar_embarque_completo` si aplica.
- `src/features/comisiones/services/vendedoras.ts`: `fetchEmbarquesSinVendedora` filtra los excluidos (join a `clientes` para resolver la herencia) y se agrega `fetchEmbarquesExcluidosComision` para el contador.
- `src/features/comisiones/components/TabVendedorasConfig.tsx`: badge/contador de excluidos y texto de ayuda.
- `src/features/embarques/utils/cierreCheckNoAplica.ts`: marcar `comision_calculada`, `comisiones_definitivas` y las reglas de comisión como "No aplica aún" cuando el embarque está excluido.

**Tests**
- Unit: resolución de herencia (cliente marcado / embarque override en ambos sentidos / ninguno).
- Unit: `cierreCheckNoAplica` con embarque excluido.
- Servicio: `fetchEmbarquesSinVendedora` excluye los marcados.
- Regresión SQL: pago sobre embarque excluido no genera comisión devengada.

**Changelog**: entrada en `CHANGELOG.md` + bump de `APP_VERSION` (minor).
