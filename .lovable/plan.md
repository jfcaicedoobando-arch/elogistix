# Estado de cuenta bancario (historial de entradas y salidas)

## Respuesta corta

Sí, es una vista que todo ERP serio tiene. En Odoo se llama "Libro mayor de la cuenta / Extracto bancario" y en QuickBooks es el "Bank register" (registro de la cuenta): una lista cronológica de cada entrada y salida con **saldo corrido** línea por línea.

Hoy en Libre Carga lo más parecido es la tabla de **Tesorería › Conciliación bancaria**, pero no funciona como estado de cuenta:

- Viene filtrada por defecto a movimientos **Pendientes**, no muestra el historial completo.
- No tiene columna de **saldo corrido** (no se ve cómo evoluciona el dinero).
- No tiene **filtro por rango de fechas** ni búsqueda por concepto/referencia.
- Los importes se pintan siempre con formato **MXN**, aunque la cuenta sea USD.
- No se puede **exportar** ni imprimir.

Es decir: es una herramienta de conciliación, no un estado de cuenta.

## Qué construir

Una pestaña nueva **Tesorería › Estado de cuenta**, con la cuenta seleccionable (y enlazada desde la tarjeta de cada cuenta bancaria y desde Conciliación).

Contenido:

1. **Encabezado del periodo**
   - Selector de cuenta y de rango de fechas (mes actual por defecto, con atajos: mes, trimestre, año).
   - Tres cifras: Saldo inicial del periodo · Total entradas · Total salidas · Saldo final.

2. **Tabla tipo estado de cuenta** (orden cronológico ascendente)

```text
Fecha       Concepto / Referencia          Salida      Entrada      Saldo
01/08/2026  Saldo inicial                                        120,450.00
03/08/2026  PAGO PROVEEDOR HK LS LIMITED    45,000.00             75,450.00
07/08/2026  DEPOSITO CLIENTE ACME                     90,000.00  165,450.00
```

   - Columna de **saldo corrido** calculada sobre el orden de fechas.
   - Chip discreto de estado de conciliación y, cuando el movimiento está conciliado, enlace al pago o factura relacionada.
   - Importes en la **moneda real de la cuenta**.
   - Filtro por texto (concepto/referencia) y por tipo (entradas / salidas / todos).

3. **Exportar** el periodo a CSV y PDF con el mismo formato, para adjuntarlo a la contabilidad.

4. Los movimientos borrados lógicamente (`deleted_at`) quedan excluidos, igual que en los saldos.

## Detalles técnicos

- Nueva ruta `/tesoreria/estado-cuenta` con `PageContainer` + `PageHeader`, registrada en `appRoutes.tsx` y en `ROUTES`.
- Nueva RPC `estado_cuenta_bancario(p_cuenta_bancaria_id, p_desde, p_hasta)` que devuelve: saldo inicial del periodo (saldo_inicial de la cuenta + abonos - cargos anteriores a `p_desde`), los movimientos del rango y los totales. Con `SECURITY DEFINER` + validación de tenant, siguiendo el patrón de `conciliacion_resumen`, y `GRANT EXECUTE` a `authenticated`.
- El saldo corrido se acumula en SQL con una window function para que la paginación no lo rompa.
- Servicio `estadoCuenta.ts` y hook `useEstadoCuenta.ts` en `features/tesoreria`, siguiendo el patrón de `fetchConciliacionResumen`.
- Tabla con `DetailTable`/`DataTable` según `docs/design-system.md`, densidad compacta, fechas con formato DD/MM/YYYY y moneda de la cuenta.
- Fechas manejadas con los helpers de fecha existentes (nada de `toISOString().slice(0,10)`), y `DatePickerMx` para el rango.
- Exportación reutilizando los utilitarios de CSV/PDF ya usados en la bitácora de tesorería.
- Tests: cálculo de saldo corrido y saldo inicial del periodo (incluye caso con movimientos borrados y cuenta en USD).

## Fuera de alcance

- Conversión de monedas: cada cuenta se muestra en su propia moneda, sin consolidado en MXN.
- Comparación contra el estado de cuenta del banco (eso sigue viviendo en Conciliación).
