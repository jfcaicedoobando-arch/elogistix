## Problema

Al hacer clic en **"Crear borrador y continuar"** en `DialogSustituirFactura` para la factura `bd75aa8…`, la RPC `duplicar_factura_para_sustitucion` responde `factura_ya_sustituida` (guarda de BD: `facturas.sustituida_por IS NOT NULL`). El diálogo lo muestra como un toast genérico "No se pudo duplicar" y el usuario queda atorado.

## Causa raíz

Dos problemas en cadena:

1. **UI no bloquea el botón.** `deriveFacturaFlags` calcula `puedeSustituirCfdi = timbradaVigente && canEdit`, pero **no** revisa si la factura ya fue sustituida (`sustituida_por` no null). Si la factura sigue en estado `Emitida` (por ejemplo, la cancelación quedó `pending` en el SAT), el botón "Sustituir CFDI" sigue habilitado aunque la BD ya tenga un sustituto asociado.
2. **Error no accionable.** Cuando la RPC devuelve `factura_ya_sustituida`, no ofrecemos ir al borrador/sustituta existente; el usuario ni siquiera sabe que ya existe.

Analogía: es como si la app dejara pedir un duplicado del pasaporte cuando ya emitiste uno; y cuando la ventanilla te lo rechaza, solo te dice "no se pudo" sin decirte dónde está el pasaporte nuevo.

## Plan

### 1. Bloquear el botón si ya hay sustituta (`facturaFlags`)

**Archivo:** `src/features/facturacion/domain/facturaFlags.ts`

- Añadir `sustituida_por?: string | null` a `FacturaFlagsInput`.
- `puedeSustituirCfdi = timbradaVigente && canEdit && !factura.sustituida_por`.
- Idem para `puedeCancelarCfdi` (no tiene sentido cancelar dos veces).
- Ajustar tests existentes en `facturaFlags.test.ts` (agregar caso: `sustituida_por` presente ⇒ ambos flags en `false`).

### 2. Diálogo maneja el error `factura_ya_sustituida`

**Archivo:** `src/features/facturacion/components/DialogSustituirFactura.tsx`

- En `handleDuplicar`, si el error trae `message === "factura_ya_sustituida"`:
  - Buscar la sustituta con `listarSustitutas(facturaId)` (ya existe en `services/sustitutasDeFactura.ts`) y tomar la más reciente.
  - Persistirla con `writePersisted` para que el flujo "Volver" siga funcionando.
  - Toast informativo (no error): "Esta factura ya tiene un borrador sustituto. Te llevamos a él."
  - Navegar a `/facturacion/<sustitutaId>?accion=timbrar`.
- Si no encontramos sustituta (edge case), caer al `notifyError` actual.

### 3. Aviso visual en el detalle cuando ya fue sustituida

**Archivo:** `src/features/facturacion/components/detalle/FacturaDetalleActionsBar.tsx` (o el header)

- Cuando `factura.sustituida_por` no sea null, mostrar un badge/enlace pequeño "Sustituida por → <numero>" que navegue al sustituto. Sin cambios de layout mayores.

### 4. Versionado y changelog

- `APP_VERSION` → `13.301.29`.
- Entrada en `CHANGELOG.md` referenciando requestId `2df07b2a-3eaf-4853-8e83-6adf43368666`.

### 5. Verificación

- `bun run ci:fast` verde.
- Actualizar/añadir tests en `facturaFlags.test.ts` cubriendo `sustituida_por`.
- (Opcional) test unitario del branch nuevo del handler en `DialogSustituirFactura`.

## Detalles técnicos

- No hay migración: la guarda en la RPC se conserva como red de seguridad servidor-side. El fix es puramente cliente + observabilidad.
- `sustituida_por` ya está expuesto en `fetchFacturaById` (se agregó junto a `sustituye_a` en 13.301.28)? Verificar: `services/detail.ts` seleccionaba `sustituye_a` pero **no** `sustituida_por`. Agregarlo a `COLUMNS` y al tipo `FacturaDetalle` es parte del paso 1.
- No se modifica la RPC ni el mecanismo de `sessionStorage`.
