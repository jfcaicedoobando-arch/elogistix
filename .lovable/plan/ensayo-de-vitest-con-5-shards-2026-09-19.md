# Ensayo de Vitest con 5 shards

## Cambios
- Cambiar el job `tests` de CI a una matriz de cinco shards, con `max-parallel: 5`, nombres `N/5` y argumento `--shard=N/5`.
- Mantener `maxWorkers=2`, sin cobertura, blobs ni cambios funcionales.
- Actualizar el guard focalizado para fijar el contrato de cinco shards y evitar regresiones a otra topología.
- Actualizar README y la guía de medición: cinco shards quedan como ensayo pendiente; las mediciones históricas de tres shards permanecen intactas.

## Validación
- Ejecutar actionlint sólo para `ci.yml`.
- Ejecutar las pruebas focalizadas de guards del workflow.
- Buscar referencias activas obsoletas a `N/3` o tres shards.
- No ejecutar una medición ni suites completas; GitHub Actions aportará los tiempos reales.

## Entrega
- Dejar el cambio listo para el commit automático de la plataforma, sin publicar ni modificar versión o CHANGELOG.
