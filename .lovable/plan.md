# Auditoría breve — Dashboard de Tesorería (`/tesoreria`)

Revisé el código de la página y la capturé a 1920×1080 con datos reales.

## Hallazgos

1. **Falta el número más importante: el saldo total.** Se muestran 4 tarjetas de cuenta (BASE MXN, BASE USD, BBVA MXN, BBVA USD) pero ningún consolidado. El dato ya existe (`saldo_bancos_mxn`) y no se usa en la pantalla.
2. **Datos calculados que nunca se muestran.** El resumen ya trae `cartera_vencida_total_mxn`, `cartera_vencida_count`, `cxp_vencidas_total_mxn`, `cxp_vencidas_count`, `por_cobrar_total_mxn` y `por_pagar_total_mxn`. La UI sólo pinta los montos por moneda, así que el usuario no ve "cuánto me deben en total" ni "cuántas facturas están vencidas".
3. **6 tarjetas de flujo con el mismo peso visual.** MXN y USD compiten con el mismo tamaño; lo importante (flujo neto) se pierde entre "por cobrar" y "por pagar".
4. **Media pantalla vacía.** A 1080p el contenido termina a la mitad: hay espacio de sobra para la curva de flujo semanal (ya existe `GraficoFlujoProyectado`, hoy sólo vive en `/tesoreria/flujo`).
5. **No hay señal de conciliación.** El botón "Conciliación" no dice si hay movimientos pendientes; el conteo existe en el servicio de conciliación (`pendientes`).
6. **Top 5 no son accionables.** Los renglones no llevan a la factura/proveedor, no hay total de la lista, y los días vencidos van en letra chica sin color por gravedad (170d se ve igual que 20d).
7. **Falta la fecha de corte.** No se indica "saldos al DD/MM/AAAA"; en un tablero financiero eso es obligatorio.
8. **Dato a verificar (no cambio de UI):** BBVA MXN y BBVA USD muestran exactamente el mismo importe (38,773.54). Puede ser coincidencia o un saldo mal capturado/importado; hay que revisar los movimientos antes de asumir un bug de código.

## Propuesta de mejora (una sola ola, sin tocar lógica de negocio)

**A. Cinta superior de KPIs (4 tarjetas jerárquicas)**
- Saldo total en bancos (MXN) + desglose por moneda como sublabel; conserva la alerta cuando el TC no es confiable.
- Por cobrar total (MXN) con sublabel "N vencidas · $X".
- Por pagar total (MXN) con sublabel "N vencidas · $X".
- Flujo neto 30 días, en verde/rojo, como la tarjeta destacada.
- Todas con `KpiCard` (el componente canónico), no con el `Stat` local de la página.

**B. Segunda fila: detalle por moneda, degradado**
- Las 6 cifras MXN/USD pasan a una tabla compacta (`DetailTable`) de 3 columnas: Moneda / Por cobrar / Por pagar / Neto. Ocupa menos y se lee mejor que 6 tarjetas.

**C. Curva de flujo semanal en el dashboard**
- Reutilizar `GraficoFlujoProyectado` en una card de ancho completo, con enlace "Ver 90 días" a `/tesoreria/flujo`. Llena el vacío y responde "¿me alcanza?".

**D. Tarjeta de conciliación**
- Badge con movimientos pendientes junto al botón "Conciliación" (o tarjeta con "N movimientos sin conciliar").

**E. Top 5 accionables**
- Cada renglón es un enlace al detalle de la factura / proveedor.
- Días vencidos con color por rango (usando la escala `aging-*` existente).
- Pie con "Total de la cartera vencida: $X (N facturas)" y enlace a Antigüedad CxC / CxP.

**F. Encabezado**
- Agregar "Saldos al DD/MM/AAAA" y mantener el badge de TC DOF visible siempre (hoy desaparece cuando no hay TC, justo cuando más importa).

## Notas técnicas

- Cambios en `src/features/tesoreria/routes/Tesoreria.tsx`, más 2–3 subcomponentes nuevos en `_sections/` para respetar el límite de 200 líneas por archivo.
- Se elimina el helper local `Stat` en favor de `KpiCard` + `DetailTable` (regla del design system).
- El conteo de pendientes de conciliación se lee del servicio existente; si requiere un hook nuevo, se agrega en `hooks/` con su query key registrada.
- Sin migraciones ni cambios de cálculo: todos los números ya vienen del agregador.
- Al cerrar: bump de `APP_VERSION` + entrada en `CHANGELOG.md`.
