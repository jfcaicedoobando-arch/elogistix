# Auditoría de bugs vigentes — flujos financieros/fiscales (HEAD)

Modo solo lectura. Verifiqué código + SQL vivo (`pg_proc`, triggers, datos reales) + suite de tests (7 829 tests: 6 rojos). Se excluyen deuda técnica, feature requests y hallazgos ya cerrados.

Analogía general: la mayoría del sistema ya tiene "cinturones de seguridad" (triggers, candados, idempotencia). Los bugs de abajo son cinturones que se abren solos cuando falta un dato.

---

## 1. Cancelar liquidación de comisión revive comisiones ya recuperadas — P0

- **Evidencia (SQL vivo):** `cancelar_liquidacion_comision` ejecuta
  `UPDATE comisiones_devengadas SET estado='Devengada', liquidacion_id=NULL WHERE liquidacion_id = p_liquidacion_id;`
  sin distinguir el estado previo. `generar_liquidacion_comision` había marcado las filas que venían de `'Por recuperar'` como `'Cancelada'` (descuento aplicado a la vendedora).
- **Escenario:** vendedora con comisión "Por recuperar"; se genera la liquidación del periodo (la descuenta); un admin cancela esa liquidación por error de monto. La comisión recuperada regresa a `'Devengada'`.
- **Impacto:** la siguiente liquidación la vuelve a pagar. Doble pago de dinero real, sin error ni traza que lo distinga.
- **Analogía:** deshacer un cobro también borra el recibo de que ya te habían descontado eso.

## 2. Conceptos de venta en EUR se pierden del total de la proforma/factura — P1

- **Evidencia:** `crear_proforma_atomica` (SQL vivo, bloque `SELECT ... INTO v_sub_usd, v_iva_usd, v_sub_mxn, v_iva_mxn`) sólo tiene ramas `moneda='USD'` y `moneda='MXN'`, con `ELSE 0`. Igual patrón en `consolidar_proformas` (`FILTER (WHERE moneda='USD'/'MXN')`). La tabla `proformas` no tiene columnas `*_eur`. La UI sí ofrece EUR: `src/features/embarques/components/conceptos/FilaVentaPrecio.tsx:44`.
- **Escenario:** concepto de venta en EUR → proforma/factura lo marca como usado pero aporta $0 al subtotal, IVA y total.
- **Agravante:** la guarda `LC_PROFORMA_TC_REQUERIDO` sólo evalúa `v_sub_usd`, así que EUR nunca dispara error: falla en silencio.
- **Impacto:** subfacturación y CFDI con detalle que no cuadra con el encabezado.
- **Estado de datos:** hoy hay **0 filas** en EUR (`conceptos_venta`/`conceptos_costo`), así que es un bug latente, no una pérdida ya materializada.

## 3. Pago en MXN a factura extranjera con T/C = 1 se sobre-abona ~17x — P1 (probable)

- **Evidencia:** `convertir_monto_pago_a_factura` (SQL vivo) valida `v_tc_fact IS NULL OR v_tc_fact <= 0`, no `<= 1`. Con `p_tc_fact = 1` devuelve el monto MXN tal cual como si fueran dólares.
- **Datos reales:** existen **119 facturas en USD con `tipo_cambio` 1 o NULL** (117 en Elogistix, 2 en Demo), todas ya `Pagada`. El trigger `trg_factura_tc_dof_obligatorio` impide crear nuevas así, pero las legacy siguen vivas.
- **Escenario:** se registra un abono MXN sobre una de esas facturas USD legacy (o una NC/reapertura) → se acredita 17 veces lo pagado y la factura se marca liquidada.
- **Impacto:** saldo de cliente falseado, cobranza cerrada indebidamente.
- **Marcado probable:** requiere una factura USD legacy reabierta para reproducirse end-to-end.

## 4. Límite de crédito falla-abierto cuando el T/C de la factura es inválido — P2

- **Evidencia:** `supabase/functions/facturapi-emitir/credito.ts:26-31` — `totalEnMxn` usa `MXN_POR_DEFECTO = 1` si `tc <= 1`. Mismo patrón en `credito_en_uso_mxn` (SQL vivo): `COALESCE(NULLIF(f.tipo_cambio,0),1)`.
- **Escenario:** cliente con límite $50 000; factura USD $3 000 con `tipo_cambio` corrupto → se valúa en $3 000 MXN en vez de ~$54 000 y no bloquea.
- **Impacto:** contradice la garantía "fail-closed" anunciada para M-15. Exposición actual baja (las 119 facturas afectadas están `Pagada`, fuera del cálculo), pero el camino de código está vivo.
- **Corrección natural:** si `moneda <> 'MXN'` y `tc <= 1`, tratar como "no verificable" (503), igual que el error de cálculo.

## 5. Notas de crédito con total $0 son timbrables — P2 (probable)

- **Evidencia:** `supabase/functions/facturapi-emitir-nota-credito/helpers.ts:101-126` valida `cantidad <= 0` y `precio_unitario < 0`, pero **no** rechaza `precio_unitario = 0` ni un total de 0. La factura normal sí tiene `validarTotalPositivo` (`facturapi-emitir/credito.ts:82-88`, B-11); la NC no tiene equivalente.
- **Escenario:** NC con todos los conceptos en $0 se timbra ante el SAT.
- **Impacto:** CFDI de egreso inútil en el buzón fiscal, requiere cancelación ante el SAT.

## 6. Dos RPCs financieras validan rol global en vez de membresía por organización — P1

- **Evidencia (SQL vivo):** `cancelar_liquidacion_comision` usa
  `EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_uid AND role = ANY(ARRAY['admin','admin_org','super_admin','contador','tesorero']))`.
  Mismo patrón en `registrar_pago_liquidacion`. `registrar_pago_proveedor_lote` y `generar_liquidacion_comision` ya migraron a `has_any_role_in_org_exact` (FIX B-6).
- **Escenario:** un `contador` de la Org A con rol de plataforma opera liquidaciones fuera del ámbito donde ese rol le fue otorgado.
- **Impacto:** privilegio financiero más amplio que el diseñado; inconsistencia con el patrón ya corregido en el resto de CxP.

## 7. Seis errores fiscales/financieros llegan al usuario en crudo — P2 (confirmado por test rojo)

- **Evidencia:** `src/lib/errors/__tests__/lcCodeCoverage.test.ts` falla en HEAD. Sin mensaje amigable: `LC_TC_FUERA_DE_BANDA`, `LC_TRASPASO_SALDO_INSUFICIENTE`, `LC_PAGO_FECHA_PREVIA`, `LC_EMBARQUE_PESO_INVALIDO`, `LC_EMBARQUE_PIEZAS_INVALIDO`, `LC_EMBARQUE_VOLUMEN_INVALIDO`.
- **Escenario:** T/C fuera de la banda 5-40, traspaso sin saldo o pago con fecha previa → el usuario ve el texto crudo de Postgres.
- **Impacto:** bloqueo operativo sin explicación accionable en pantalla.
- **Regresión reciente:** los códigos son de las olas de banda T/C y traspasos; el mapa de mensajes no se actualizó con ellos.

## 8. Guard de test de multimoneda CxP desalineado con la función vigente — P3 (falso positivo de test, no bug de negocio)

- **Evidencia:** `src/lib/__tests__/cxp-multimoneda-fase-l.test.ts:39` exige `LC_PAGO_CRUCE_NO_SOPORTADO` en la última migración de `convertir_monto_pago_a_factura`, pero la función vigente **sí** soporta cruces con EUR pivoteando en MXN (M-2) y ya no emite ese código.
- **Impacto:** CI rojo y falsa señal de que EUR está bloqueado. Es el test el que quedó viejo, no la lógica.

---

## Regresiones recientes / estado de CI

Además de los puntos 7 y 8, hay 4 tests más rojos en HEAD (no financieros): `useMutationsEmbarque` ("inserta contenedores hijos" no llama `crearMuchos` — posible regresión funcional real que vale reproducir) y tres ratchets de arquitectura/higiene (`audit-report`, `architecture-baseline`) por archivos productivos >200 líneas. Lint reporta 5 funciones sobre el límite de complejidad, dos de ellas en rutas fiscales: `supabase/functions/facturapi-emitir/index.ts` (18) y `src/features/cotizacion/services/mutations/update.ts` (17). Typecheck limpio.

## Revisado y descartado (no son bugs vigentes)

Redondeo JS vs Postgres (`roundMoney` ya alineado con `ROUND(numeric,2)`), IVA por línea en consolidación de proformas, PUE de una sola exhibición con tolerancia de 5 centavos (`_assert_pago_pue_exhibicion_unica`, decisión de producto), NC de cliente en moneda no convertible (`guard_nc_cliente_moneda_convertible` bloquea en insert), T/C DOF obligatorio en facturas extranjeras nuevas (trigger activo), dedupe de pagos por `client_request_id`, idempotencia y orden de eventos del webhook FacturAPI, `.range()` en bandejas de CxP/facturación, y N13/N14 (anticipos EUR) por ser decisiones cerradas.

## Prioridad sugerida

1. **#1** (doble pago de comisiones) — una migración con `CASE` para devolver las recuperadas a `'Por recuperar'`.
2. **#3 y #4** (T/C = 1 tratado como válido) — endurecer a `<= 1` y fail-closed; misma clase de bug en dos lugares.
3. **#2** (EUR en venta) — decidir si se soporta EUR o se retira del selector con candado server-side.
4. **#6, #5, #7, #8** — fixes pequeños y localizados.

Antes de tocar #2 y #6 necesito dos definiciones: ¿EUR en conceptos de **venta** es intencional o se copió del selector de costos? ¿Un usuario puede tener rol financiero en más de una organización a la vez?
