# Correr la validación de CI aquí (pruebas, lint, typecheck, auditorías)

Objetivo: ejecutar la batería completa de validación en este entorno, leer los resultados sin que se corten por tiempo, y entregarte un resumen de qué pasó y qué falló.

## Cómo se va a correr

Las suites tardan más de 10 minutos, así que se lanzan en segundo plano (proceso desacoplado con `setsid nohup`), escribiendo cada salida en su propio archivo de registro bajo `/tmp/ci/`, y se consulta el avance con revisiones cortas hasta que termine. Sin corridas simultáneas.

Orden:

1. Pruebas unitarias completas (`bun run test`)
2. Revisión de estilo de código (`bun run lint`)
3. Revisión de tipos (`bunx tsgo --noEmit`)
4. Auditorías internas (`bun run audit:all`)

Quedan fuera, porque necesitan base de datos o navegador reales que no existen aquí: las suites de base de datos/RLS (`db:postcheck`, guards SQL) y las pruebas de extremo a extremo con navegador. Esas siguen corriendo en GitHub Actions.

## Qué entrego al final

- Conteo de archivos y pruebas que pasaron/fallaron.
- Lista de fallos con el archivo y la causa aparente de cada uno.
- Estado de estilo, tipos y auditorías.
- Recordatorio explícito de lo que queda pendiente en GitHub Actions.

## Sobre arreglos

Esta corrida es sólo de diagnóstico: no se cambia código, ni pruebas, ni baselines, ni workflows para tapar fallos. Si aparecen fallos, te los reporto y decides si los corregimos en un turno siguiente.
