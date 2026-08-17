# Parche 8 — Precisión en pagos, idempotencia y candados

El parche 8 aplica limpio sobre el estado actual del proyecto (verificado en seco: 20 archivos, sin conflictos). Depende del parche 6, que ya está aplicado.

## Qué se corrige

1. **Centavos fantasma (BL-12).** Las multiplicaciones sueltas de cantidad × precio en conceptos de venta, cotizaciones y el P&L pasan a usar el cálculo central del sistema, para que la pantalla y la base de datos den exactamente el mismo total.
2. **Pagos duplicados (BL-14).** Cada vez que se abre el modal de registrar pago (cliente o proveedor) se genera un identificador único de intento. Si se hace doble clic o el internet se corta y reintenta, el segundo intento se rechaza como duplicado en vez de registrar el dinero dos veces.
3. **Diferencia cambiaria faltante (BL-15).** Cuando se paga en dólares una factura de proveedor emitida en pesos, ahora se calcula la diferencia cambiaria; antes sólo se calculaba en el sentido inverso. También se traduce a español el error de cruces de moneda no soportados (euros).
4. **Embarques en papelera (BL-16).** Un embarque eliminado ya no puede avanzar de estado ni consumir folio de expediente.
5. **Aviso de tipo de cambio en comisiones (BL-17b).** La nota "tipos de cambio incompletos" sólo aparece si el embarque realmente usa esas monedas; un embarque sólo en dólares ya no se marca como incompleto por no tener tipo de cambio de euro.
6. **Residuo de un centavo (EC-12).** El prellenado del pago de saldo total redondea hacia arriba al centavo, así la factura queda saldada. Si queda un residuo menor o igual a un centavo, el sistema explica que se cierre con la opción "Cerrar sin pago" en lugar de dejarla abierta para siempre en antigüedad de saldos.

## Cómo se aplicará

1. Aplicar las 4 migraciones de base de datos en orden, cada una con la herramienta de migración para tu aprobación:
   - columnas e índices únicos de idempotencia en pagos de cliente y proveedor
   - `guard_pago_proveedor` con diferencia cambiaria dólar→peso
   - `avanzar_estado_embarque` ignorando registros en papelera
   - `calcular_comision_pago` con la nota de tipo de cambio condicionada
2. Aplicar los cambios de código del parche (16 archivos de frontend/servicios más las 2 fuentes canónicas SQL del repositorio). Los tipos generados de la base de datos se regeneran automáticamente tras las migraciones, así que no se editan a mano.
3. Verificar tipos y correr la suite de pruebas (incluye el nuevo caso del residuo de un centavo).
4. Actualizar `CHANGELOG.md` y subir `APP_VERSION` a `13.638.0`.

## Detalle técnico

- El parche se aplica con `patch -p1` (verificado con `--dry-run`, exit 0).
- Las redefiniciones SQL son `CREATE OR REPLACE` conservando firma, `SECURITY DEFINER`, `search_path` y grants (regla H6).
- Índice `UNIQUE` parcial `WHERE client_request_id IS NOT NULL`; el conflicto 23505 se traduce a un mensaje de pago duplicado.
- Riesgo conocido: el autor del parche no pudo correr `tsgo` ni `vitest`; ambos se ejecutan aquí antes de cerrar.
