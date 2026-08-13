# Ola 4 — Inteligencia del proveedor

Cierre de la serie: las Olas 1-3 dejaron el expediente reconciliado (comprometido → facturado → pagado), el estado de cuenta con antigüedad y el archivo documental. La Ola 4 responde a las preguntas de decisión: **¿este proveedor factura bien, cobra caro y me va a dar un problema pronto?**

Analogía: hasta ahora armamos el expediente completo del proveedor. Ahora le ponemos el semáforo y la calificación, para no tener que leer todo el expediente cada vez.

## Lo que se construye

### 1. Scorecard ampliado (pestaña Salud)
La pestaña Salud hoy muestra gasto 12m, saldo, % pagadas a tiempo, días promedio de pago, notas de crédito y embarques activos. Se le añade:

- **Puntualidad de facturación**: días promedio entre el cierre operativo del embarque y la fecha de la factura del proveedor, con semáforo (≤7 días bien, 8-20 medio, >20 tarde).
- **Desviación presupuesto vs factura**: % promedio y monto de diferencia entre lo comprometido y lo facturado, señalando si el proveedor tiende a facturar de más.
- **Ticket promedio** por factura y **% de partidas facturadas** (cobertura de facturación).
- **Top 5 conceptos** por gasto y **Top 5 rutas** (origen → destino) donde se usa este proveedor.

### 2. Tendencia 12 meses: comprometido vs facturado vs pagado
La gráfica actual solo trae facturado. Se convierte en una gráfica de 3 series mensuales con leyenda, para ver visualmente el rezago de facturación (la barra de comprometido adelantada respecto a la de facturado) y el rezago de pago.

### 3. Comparativo entre proveedores
Tarjeta nueva: para los conceptos más usados de este proveedor, se compara su costo unitario promedio contra el promedio de los demás proveedores del mismo tipo (naviera, transportista, agente, etc.) en los últimos 12 meses, en la misma moneda. Muestra "más caro / en línea / más barato" con el % de diferencia y el número de operaciones comparadas, ocultando comparaciones sin muestra suficiente (mínimo 3 operaciones por lado) para no dar conclusiones falsas.

### 4. Alertas proactivas
Barra de alertas arriba de la pestaña Salud, cada una accionable (lleva al listado o al modal correspondiente):

- Embarques cerrados de este proveedor **sin factura capturada** (con monto comprometido).
- Facturas **por vencer** en los próximos 7 días y facturas **ya vencidas**.
- **Datos bancarios incompletos** (nacional: banco + CLABE; extranjero: SWIFT/IBAN o ABA + beneficiario) cuando hay saldo por pagar — bloqueo lógico antes de programar un pago.
- **Documentos del expediente vencidos o por vencer** (reutiliza la vigencia que ya guarda la Ola 3).

## Detalles técnicos

- **Datos**: una sola RPC nueva `public.proveedor_inteligencia(p_proveedor_id uuid)` que devuelve `jsonb` con las secciones `scorecard`, `tendencia`, `comparativo` y `alertas`. `SECURITY DEFINER`, `SET search_path = public`, filtrada por `organization_id` del usuario, con `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated, service_role` (regla H6). No se crean tablas ni columnas: todo sale de `conceptos_costo`, `proveedor_facturas`, `proveedor_facturas_conceptos`, `pagos_proveedor`, `embarques` y `proveedor_documentos`.
- **Dominio puro**: `src/features/proveedor/domain/inteligenciaProveedor.ts` con el cálculo de semáforos, clasificación del comparativo, umbral de muestra mínima y orden de severidad de alertas — 100% testeable sin red.
- **Servicio + hook**: `services/proveedorInteligencia.ts` (mapeo tipado, sin `any`, manejo de `error`) y `hooks/useProveedorInteligencia.ts` con clave centralizada `proveedores.inteligencia(id)` en `queryKeys.ts`.
- **UI (Power of 10, cada archivo ≤200 líneas)**: `ProveedorScorecardCards.tsx`, `ProveedorTendenciaChart.tsx`, `ProveedorComparativoCard.tsx`, `ProveedorAlertasCard.tsx`; `ProveedorSaludTab.tsx` queda como composición delgada. Estados de carga con skeleton, estado de error con `ErrorStateInline` y estado vacío distinguido de error.
- **Formato**: es-MX, DD/MM/YYYY, MXN base con equivalente por T/C del DOF y aviso cuando falta T/C; nada de IVA hardcodeado (`financialUtils`, `roundMoney`).
- **Tests**: dominio (semáforos, desviación, comparativo con muestra insuficiente, orden de alertas), servicio (mapeo y error de la RPC), hook (query key e invalidación) y componentes (render con datos, vacío y error). Sin bajar umbrales de coverage.
- **Cierre**: bump de `APP_VERSION` a `13.559.0` y entrada en `CHANGELOG.md`.

## Fuera de alcance

Los puntos 9-15 del plan original (pestañas propias de Facturas y Pagos, condiciones comerciales, contactos múltiples, bitácora) quedan como Ola 5 si los quieres después.
