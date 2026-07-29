## Contexto

Las Etapas 1 y 2 ya están aplicadas y verificadas (C1 permisos de borrado, C2 roles en funciones fiscales, C5 filtro de eliminados en 9 RPCs, más la suite de regresión en CI). Faltan los tres críticos restantes del documento: **C3**, **C4** y **C6**.

Estado actual verificado ahora mismo:
- `supabase/config.toml` no tiene sección `[api]` → el límite de PostgREST sigue en el default de 1000 filas.
- No existen `src/lib/supabase/assertNotTruncated.ts` ni `src/lib/financial/convertir.ts`. Sí existe `src/lib/financial/tcValido.ts`.
- En la base sólo existe `recalc_factura_retenciones`; no existen `recalc_factura_totales`, `cotizacion_totales_conceptos` ni ninguna de las 5 RPCs agregadoras de C3c.
- Siguen vivas las consultas de dinero con tope alto: `loaders.ts:54/62` (10000/20000), `dashboardEjecutivo.ts:145` (10000), `cobranza.ts:93`, `estadoCuenta.ts:129`, `conciliacion.ts:72`, `facturasCrud.ts:118` (2000).

En analogía simple: hoy la app pide "tráeme todas las facturas", el servidor le manda calladamente sólo las primeras mil, y la app suma esas mil y presenta el resultado como si fuera el total. Nadie se entera.

---

## Etapa 3 — C3: se acabó el truncado silencioso

**3a. Red de seguridad**
- Añadir `[api] max_rows = 10000` a `supabase/config.toml`.
- Nota para ti: en el proyecto hosted el valor equivalente se ajusta desde la configuración del backend; te indico el paso al terminar (no se puede hacer desde el repo).

**3b. Guarda visible en cliente**
- Nuevo `src/lib/supabase/assertNotTruncated.ts` con `ResultadoTruncadoError` (código `LC_RESULTADO_TRUNCADO`).
- Aplicarlo con constante de límite nombrada en: `cobranza.ts`, `estadoCuenta.ts`, `conciliacion.ts`, `dashboardEjecutivo.ts`, `direccion/services/loaders.ts`, `crm/services/forecast.ts`, `crm/services/leaderboard.ts`, `facturasCrud.ts`.
- Resultado: si alguna vez se corta, la pantalla muestra un error claro en vez de una cifra equivocada.

**3c. Solución estructural: sumar en el servidor**
- Nueva migración `20260730100000_c3_agregados_dinero_rpc.sql` con 5 funciones `STABLE SECURITY DEFINER`, guard de organización, `deleted_at IS NULL` en todas las tablas y grants revocados de `PUBLIC`/`anon`:
  `cobranza_agregados`, `estado_cuenta_agregados`, `conciliacion_resumen`, `dashboard_facturacion_kpis`, `direccion_totales`.
- Migrar los services y hooks consumidores a usar las RPCs (los KPIs dejan de calcularse en el navegador).
- Política de conversión en SQL alineada con C6: moneda extranjera sin tipo de cambio confiable no se suma y se cuenta aparte para poder avisar en la UI.

---

## Etapa 4 — C4: los totales los calcula el servidor, no el navegador

Migración única `20260730000002_fix_c4_totales_server_side.sql`:
- **C4a Facturas:** función canónica `recalc_factura_totales(uuid)` que re-deriva subtotal, IVA por renglón, retenciones y total desde `conceptos_factura`; `recalc_factura_retenciones` queda como envoltorio para no romper el trigger existente. Trigger anti-escritura directa + CHECK de consistencia con tolerancia de 1 centavo (NOT VALID). No afecta el timbrado: las facturas ya emitidas siguen protegidas por `factura_inmutable` y el backfill sólo toca las que no tienen snapshot de emisión.
- **C4b Cotizaciones:** `cotizacion_totales_conceptos(jsonb)` (IMMUTABLE) + RPC `recalcular_subtotal_cotizacion(uuid)` + trigger de validación del jsonb (`LC_COTIZACION_CONCEPTO_INVALIDO`). Corrige la semántica rota: subtotal = neto sin IVA y separado por moneda.
- **C4c CxP:** trigger que impone `total = subtotal + iva + ieps − retenciones`, rechaza totales negativos (`LC_CXP_TOTAL_NEGATIVO`) y bloquea bajar el total por debajo de lo ya pagado más notas de crédito aplicadas (`LC_CXP_TOTAL_MENOR_PAGADO`).
- Ajustar el frontend afectado (factura manual, wizard de cotización, edición de factura de proveedor) para consumir los valores server-side en vez de persistir los suyos.

---

## Etapa 5 — C6: una sola forma de convertir moneda

- Nuevo `src/lib/financial/convertir.ts` como canon único: MXN factor 1; USD/EUR exigen tipo de cambio válido y mayor a 1; sin tipo de cambio confiable devuelve `completo: false` y no suma; fallback sólo si se pasa explícito y queda marcado como tal. Incluye `factorEntreMonedas`.
- Migrar los 6 sitios divergentes (`flujoProyectado.ts`, `calcularTotalMxn.ts`, `direccion/services/mxn.ts`, `carteraFx.ts`, `DialogRegistrarPago.tsx` — que hoy deduce el tipo de cambio dividiendo montos — y `financialUtils.ts`, que queda deprecado sin defaults `= 1`).
- `dashboardEjecutivo.ts` se omite aquí porque su helper desaparece con la Etapa 3c.
- Guardrail: regla ESLint + test de arquitectura `conversion-canon-fase-c6` para impedir una séptima implementación.

---

## Detalles técnicos y verificación

- Migraciones nuevas: `20260730000002` (C4) y `20260730100000` (C3c). Sin solape de objetos con las ya aplicadas.
- Tras aplicar migraciones se regeneran los tipos de la base para no acumular casts.
- Tests: unitarios para `assertNotTruncated` y `convertir.ts`; suite RLS/pgTAP nueva para las 5 RPCs agregadas (aislamiento por organización + exclusión de eliminados), registrada en la matriz de CI; casos de trigger para C4a/C4b/C4c (total inconsistente rechazado, bajar total por debajo de lo pagado rechazado).
- Al cierre de cada etapa: lint sin warnings, tests de arquitectura y CI rápido; `APP_VERSION` + `CHANGELOG.md` actualizados por etapa.
- Riesgo controlado a vigilar en C4a: el backfill puede corregir totales legacy visibles en facturas borrador; se reporta el conteo de filas ajustadas antes de continuar.
