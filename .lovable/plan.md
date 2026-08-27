# Qué falta de la auditoría 3 y qué vale la pena

Resumen: de los 26 hallazgos, los 6 Critical y casi todos los High ya quedaron cerrados en las Olas 1–4 (v13.770.0 – v13.772.0). Lo que sigue abierto es **1 fuga real de información (C9)** y **deuda técnica media/baja**. No hay dinero mal calculado pendiente en el flujo normal.

## Verificado hoy en el código

Ya implementado (revisado en el esquema): conversión de moneda de notas de crédito en `saldo_factura`, `cartera_pendiente` y `nc_aplicadas_en_moneda_factura` (C1/C1b); triggers de organización padre-hijo (C2–C5); prohibición de borrado físico de facturas (C6); `ensure_demo_membership` fuera del alcance de usuarios (C7); folio fiscal único y de una sola escritura (C8); cierre de periodo contable (H1); validación de facturas de proveedor con justificación (H2); inmutabilidad de cotización aceptada y conceptos ya proformados (H3/H4); bloqueo optimista en CxP, tesorería y contactos (H5); llaves de organización en tablas de CxP y pagos (H6); limpieza financiera al resembrar la demo (H7).

Sigue abierto:

- **C9 — costos y utilidad visibles por API a quien la interfaz se los oculta.** `dashboard_details()` y `dashboard_summary()` devuelven `costoUSD`, `profitMXN` y `margen` sin verificar el rol, y existe una política que deja al rol `viewer` leer `cotizacion_costos`. La tabla ya tiene el candado bueno (`puede_ver_costos_cotizacion`), pero las dos RPC del dashboard no.
- **M1 — utilidad por cliente puede salir en 0 sin avisar** cuando el embarque no tiene tipo de cambio capturado, y no resta notas de crédito ni excluye canceladas.
- **M2 — factura en dólares nace con tipo de cambio 1** al convertir la proforma, y luego el timbrado la rechaza.
- **M3/M4/M5/M7 — validaciones de captura**: correos de cliente duplicados, clientes "facturables" incompletos creados por API, eventos de embarque con fechas ilógicas, montos sin techo en costeo.
- **M6/H8 — higiene de migraciones**: parches por reemplazo de texto y base limpia que aún depende del arnés propio.
- **M8, L1–L4 — comodidad y pulido**: filtros que no viajan en la URL, orden sin desempate estable, un mensaje de error de la nube demasiado verboso, reporte de importación CSV sin detalle, código muerto de IVA.

## ¿Vale la pena?

Sí, pero solo una parte y por etapas:

- **Ola 5 (sí, esta semana):** C9. Es una fuga real: un vendedor puede ver el margen de la empresa consultando la API. Es acotado (dos funciones y una política).
- **Ola 6 (sí, vale claramente):** M1 y M2. Son números que el equipo ve todos los días y una factura en dólares que hoy se atora al timbrar.
- **Ola 7 (opcional, cuando haya calma):** M3, M4, M5, M7 — calidad del dato de captura. Evitan basura acumulada, no arreglan nada roto hoy.
- **Ola 8 (recomendado pero invisible al usuario):** M6/H8, la base limpia en CI. Es lo que evita que un fix se deshaga solo, como ya pasó.
- **No vale la pena ahora:** M8 y L1–L4. Son comodidad; el riesgo es cero y el costo no es trivial (M8 toca todos los listados).

## Detalle técnico por ola

### Ola 5 — C9 (visibilidad de costos)
1. Migración: crear `public.puede_ver_costos_dashboard(uuid)` (o reutilizar `puede_ver_costos_cotizacion`) alineada con `COST_VIEWERS` de `permissionMatrix.ts`.
2. En `dashboard_details()` y `dashboard_summary()` (fuentes canónicas en `supabase/schema/dashboards/`): si el usuario no puede ver costos, devolver el mismo JSON con `costoUSD`, `costoMXN`, `profitUSD`, `profitMXN`, `margen*` en `null` — no romper el shape que consume el front.
3. Eliminar la política `Tenant viewer cotizacion_costos` (deja al rol `viewer` leer costos, contradiciendo `puede_ver_costos_cotizacion`).
4. Prueba SQL en `supabase/tests/`: sesión `vendedor` y `viewer` no reciben costos ni de las RPC ni de la tabla; `admin_org`/`gerente_operaciones` sí.
5. Ajustar el front solo si algún componente asume número donde ahora llega `null`.

### Ola 6 — M1 y M2
- `profit_por_cliente`: `NULLIF(b.tipo_cambio_usd, 0)` y fail-closed cuando el tipo de cambio es nulo (devolver `null`, no 0); restar `nc_aplicadas_en_moneda_factura` y excluir facturas canceladas; indicar en la interfaz cuántos embarques quedaron sin valuar.
- Conversión proforma→factura: resolver el tipo de cambio DOF de la fecha de emisión con `tc_para_documento` en lugar de fijar 1, y bloquear la creación si no hay tipo de cambio disponible (mensaje `LC_*` claro).

### Olas 7 y 8 (esbozo)
- M3: índice único parcial sobre `lower(btrim(email))` por organización + herramienta de fusión de duplicados.
- M4: RPC canónica de alta de cliente con estado prospecto/facturable y checks condicionales.
- M5: trigger de cronología en `eventos_embarque` (no antes de la creación del embarque, orden salida→llegada→entrega).
- M7: esquema Zod compartido de montos con techo + `CHECK` en base.
- M6/H8: una fuente por función bajo `supabase/schema/` (ya existe el patrón) y trabajo de CI para reset canónico sin exenciones.

## Alcance sugerido para aprobar ahora
Ola 5 completa (fuga de costos) + Ola 6 (utilidad por cliente y tipo de cambio de facturas en dólares), con su versión y entrada en `CHANGELOG.md`. Las olas 7 y 8 quedan documentadas como pendientes.
