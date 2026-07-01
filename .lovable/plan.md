## Sentry: revisión de errores abiertos

Encontré 3 issues abiertos en `elogistix`. Sólo 1 es accionable ahora mismo; los otros dos los cierro/monitoreo.

### 1. `JAVASCRIPT-REACT-1M` — cotizacion_costos_cantidad_pos (46 eventos, 6 usuarios) ← el importante

Analogía: es como intentar guardar una factura con "0 piezas" cuando la caja registradora exige mínimo 1. La BD tiene un check constraint `cantidad > 0` en `cotizacion_costos` y estamos insertando `cantidad = 0`.

**Causa raíz:** en `SeccionCostosInternosPLLocal.tsx` (línea 46) se llama:
```
buildCostosDesdeTarifa({ ..., cantidad: numContenedores })
```
Cuando el usuario aún no captura el número de contenedores (paso CIF, borrador vacío, wizard nuevo), `numContenedores` llega como `0`. `buildCostosDesdeTarifa` respeta ese 0 (sólo aplica default 1 si `cantidad` es `undefined`), y las filas se guardan con `cantidad = 0` → viola el constraint al insertar.

**Fix (frontend, mínimo invasivo):**
- En `buildCostosDesdeTarifa.ts`: normalizar con `const qty = Math.max(1, Number.isFinite(cantidad) ? cantidad : 1)` y usar `qty` en las filas.
- En `SeccionCostosInternosPLLocal.tsx`: pasar `cantidad: Math.max(1, numContenedores || 1)` (defensa en profundidad).
- En `aplicarTarifa.ts`: mismo guard.
- Test nuevo en `buildCostosDesdeTarifa.test.ts`: `cantidad: 0` → filas con `cantidad === 1`.

### 2. `JAVASCRIPT-REACT-1T` — timeout FacturApi (1 evento, 1 usuario)

Error de red esperado y ya manejado con mensaje claro al usuario. Lo marco como **resuelto** en Sentry (ruido operativo, no bug). Si vuelve a aparecer con volumen, revisamos.

### 3. `JAVASCRIPT-REACT-1K` — "Invalid login credentials" (3 eventos, 0 usuarios impactados)

Es un error esperado de Supabase Auth cuando el usuario teclea mal la contraseña. No debería reportarse a Sentry. Lo marco como **resuelto** y añado a la lista de errores ignorados en el cliente Sentry (`beforeSend` filtra mensajes `Invalid login credentials`).

### Entregables (build mode)

1. `src/features/cotizacion/components/seccionRuta/buildCostosDesdeTarifa.ts` — normalizar cantidad ≥ 1.
2. `src/features/cotizacion/components/SeccionCostosInternosPLLocal.tsx` — guard en la llamada.
3. `src/features/cotizacion/components/seccionRuta/aplicarTarifa.ts` — guard en la llamada.
4. `src/features/cotizacion/components/seccionRuta/__tests__/buildCostosDesdeTarifa.test.ts` — test regresión `cantidad: 0`.
5. Filtro `beforeSend` en el init de Sentry para descartar `Invalid login credentials`.
6. Marcar 1T y 1K como resueltos en Sentry.
7. Bump `APP_VERSION` + entrada en `CHANGELOG.md`.
