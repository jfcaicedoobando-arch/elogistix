## Contexto

**COT-2026-0076 → ELIMP00272** es Marítimo **FCL** con 6 contenedores 40HC capturados (números de contenedor reales), pero los campos `peso_kg`, `volumen_m3` y `piezas` quedaron en 0 en cada hijo. El trigger `sync_embarque_desde_contenedor` propaga la suma (0) al embarque padre, por eso la tabla muestra "faltan datos". La cotización origen también tiene esos campos en 0, así que no hay valor canónico para auto-rellenar.

A diferencia de los bugs LCL ya corregidos (v13.66.8 / v13.66.9), aquí no hay bug de mapper ni de helper: el wizard FCL permite guardar los contenedores con totales en 0 porque al momento de crear el embarque pueden no conocerse. La decisión de producto es **exigirlos sólo más adelante, antes de cerrar el embarque o generar la primera proforma**.

ELIMP00272 se deja como está: el usuario lo edita desde la UI de contenedores cuando tenga los pesos reales.

## Cambios

### 1. Regla nueva en `validar_cierre_embarque` (RPC)

Migración que reemplaza la función `public.validar_cierre_embarque(uuid)` agregando un check extra:

- **Regla**: `contenedores_datos_completos`
- **Aplica sólo** cuando `embarques.modo = 'Marítimo'` AND `embarques.tipo_servicio = 'FCL'`.
- **Falla** si existe algún `embarque_contenedores` del embarque con `peso_kg <= 0` o `volumen_m3 <= 0` (piezas opcional, dado que algunos clientes FCL no las desglosan).
- **Detalle** devuelto: `{ contenedores_incompletos: <int>, ids: [uuid...] }` para que la UI pueda enlazar.
- Para modos/servicios distintos (Aéreo, Terrestre, LCL) el check devuelve `ok: true` automáticamente.

El check se suma a `v_checks` y participa en `v_puede_cerrar` igual que las reglas actuales (`cxc_cobrada`, `cxp_pagada`, `docs_completos`, `pnl_margen_minimo`).

### 2. UI de cierre

`src/features/embarques/components/TabCierre.tsx`: agregar etiqueta en `ETIQUETAS_REGLA`:

```ts
contenedores_datos_completos: "Datos de contenedores capturados (peso y volumen)",
```

No requiere más cambios: `CierreChecklistCard` ya renderiza dinámicamente cualquier regla devuelta por la RPC.

### 3. Pre-check al generar proforma

Punto único: hook `useProformas` (o el componente que abre el wizard `PasoConfirmacionProforma`).

- Antes de abrir el flujo de creación de proforma, ejecutar una verificación cliente: si el embarque es Marítimo FCL y cualquiera de sus `embarque_contenedores` tiene `peso_kg=0` o `volumen_m3=0`, mostrar `toast.error` en español ("Captura peso y volumen de todos los contenedores antes de generar la proforma.") y abortar.
- Implementación: pequeña función `validarContenedoresFCL(embarqueId)` en `src/features/embarques/services/` que hace un `select id, peso_kg, volumen_m3 from embarque_contenedores where embarque_id=?` y aplica el mismo criterio que la RPC. Reusable también desde `submitProformaDialog.ts`.
- No se duplica lógica de cierre: la validación de cierre sigue siendo server-side via RPC; el pre-check de proforma vive sólo en cliente porque la RPC `crear_proforma_atomica` no conoce esta regla.

### 4. Tests

- `src/features/embarques/services/__tests__/validarContenedoresFCL.test.ts` (nuevo): cubre Marítimo FCL con incompletos / completos, LCL marítimo (siempre ok), Aéreo (siempre ok).
- `src/features/embarques/components/__tests__/TabCierre.rules.test.ts` (existente): añadir caso para la nueva regla en la lista de etiquetas.

### 5. Metadata

- Bump `APP_VERSION` → `13.66.10`.
- Entrada en `CHANGELOG.md` describiendo: "Cierre y proforma exigen peso y volumen capturados en cada contenedor FCL antes de proceder. No afecta LCL, Aéreo ni Terrestre. ELIMP00272 queda pendiente de edición manual del usuario."

## Fuera de alcance (confirmado por el usuario)

- No se toca ELIMP00272 ni los 6 contenedores (el usuario los editará desde la UI).
- No se exigen peso/volumen/piezas en cotizaciones FCL.
- No se bloquea el guardado del wizard de embarque al crear (sólo al cerrar o facturar vía proforma).

## Detalles técnicos clave

- La RPC seguirá expuesta sólo a `authenticated` (igual que hoy) con `REVOKE EXECUTE ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated`.
- La función mantiene `SECURITY DEFINER` y `SET search_path = public` ya presentes.
- El criterio "peso_kg > 0 AND volumen_m3 > 0" se basa en NUMERIC, no en NULL, para compatibilidad con filas existentes que tienen `0` por default.
- El check se ejecuta **después** de los otros para no enmascarar errores financieros más graves en el orden visual del checklist.
