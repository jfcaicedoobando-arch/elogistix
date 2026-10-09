# CxP: centavo íntegro sin cobertura (13.824.58)

## Contrato

En moneda de la factura, S es el saldo canónico y C es la suma neta de pagos vivos (incluidos anticipos aplicados y ajustes válidos) y notas de crédito aplicadas/vivas. Se considera liquidada por saldo cuando S <= 0, o cuando S <= 0.01 y C > 0. No se suman otra vez las aplicaciones de anticipos. La tolerancia inclusiva histórica se conserva para remanentes reales.

Una factura positiva sin cobertura no pierde sus días vencidos ni su estado derivado por tener sólo un centavo pendiente. El estado Pagada explícito histórico conserva su precedencia de presentación; no hay barrido ni backfill. Un recálculo explícito después de reversar la última aplicación vuelve a Vigente/capturada.

El cierre calcula `facturas_sin_cobertura` por factura antes del factor de atribución al embarque. Una factura hermana pagada, un sobrepago en otra moneda o una participación fraccional no pueden ocultarla. Se conservan los guards de conversión y el umbral agregado por moneda para remanentes cubiertos. El formatter muestra el centavo cuando ese contador explica el bloqueo.

El badge administrativo sigue consumiendo su resumen histórico; ahora invita a revisar el diagnóstico, sin afirmar que el embarque esté listo para cerrar.

## Migración

`20261009174000_cxp_centavo_sin_cobertura.sql` reemplaza sólo dos funciones. Antes exige los cuerpos revisados, propietario, ACL, SECURITY DEFINER y search_path esperados. Después confirma la misma metadata. No ejecuta backfill, pagos, DML de negocio, GRANT/REVOKE ni cambios de RLS. Un drift aborta la transacción. No aplicar manualmente el espejo de esquema, que conserva sus instrucciones históricas de permisos.

## Verificación

- Vitest focalizado: 82/82; sobre las fuentes originales, 13 de esas 82 pruebas fallan.
- SQL local PostgreSQL 17.9: matriz de funciones reales, vista de saldo y conversores reales. Candidato 65/65 frente a baseline 37/65. El harness reproducible está en `scripts/db/cxp-cent-regression/`.
- Las pruebas SQL aíslan dependencias de autenticación, comisión y P&L no relacionadas. No cubren triggers completos, RLS ni concurrencia. No sustituyen CI integral ni validación del despliegue.
- Se conserva el parser heredado que normaliza ciertos valores ausentes/no finitos del servicio de saldos. El predicado nuevo rechaza entradas no finitas recibidas, pero no puede detectar información ya normalizada aguas arriba; no se afirma protección integral frente a corrupción de datos.
- No se ha ejecutado SQL remoto ni despliegue con este paquete. La validación GUI y CI oficial quedan como gates posteriores.
