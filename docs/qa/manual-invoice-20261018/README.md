# Factura manual: experimento local ASUS

Base: `446036fb04cfd56fac4c35b75f0da9c9d94361d9` (`main` al crear el checkout).
Rama independiente: `codex/asus-manual-invoice-benchmark`.
Este experimento no habilita la demo pública deshabilitada del producto.

**Decisión: conservar producto sin cambios.** El candidato evita trabajo al
escribir notas y supera el umbral en 20 conceptos en los dos bloques. Sin embargo,
la edición de descripción muestra mayor mediana en 7/8 rondas. Las pruebas
funcionales pasan, pero no acreditan ausencia de regresión de rendimiento. Este
PR sólo incorpora demo, scripts y evidencia; no modifica `src`, dependencias,
configuración productiva, versión, arquitectura ni workflows.

## Resultados

Trabajo del renderer por pulsación en notas, ms. Cada celda muestra
**mediana / p95**, con 100 pulsaciones medidas por variante/carga/bloque:

| Conceptos | Bloque | Base | Candidato | Ahorro p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 8,301 / 13,233 | 7,286 / 11,166 | 2,067 ms (15,6%) |
| 1 | 2 | 8,456 / 14,143 | 7,386 / 12,352 | 1,791 ms (12,7%) |
| 20 | 1 | 21,785 / 32,804 | 9,829 / 17,825 | 14,979 ms (45,7%) |
| 20 | 2 | 20,576 / 31,682 | 9,765 / 15,766 | 15,916 ms (50,2%) |
| 100 | 1 | 69,203 / 106,691 | 11,580 / 18,009 | 88,682 ms (83,1%) |
| 100 | 2 | 68,078 / 104,506 | 11,590 / 19,376 | 85,130 ms (81,5%) |

Al editar conceptos con 20 filas, la tabla y los derivados vuelven a ejecutarse
correctamente en ambas variantes. Los tiempos no muestran un ahorro general:

| Campo | Bloque | Base mediana / p95 | Candidato mediana / p95 |
| --- | ---: | ---: | ---: |
| Descripción | 1 | 19,092 / 34,038 | 21,099 / 34,855 |
| Descripción | 2 | 19,310 / 29,045 | 20,757 / 29,739 |
| Cantidad | 1 | 23,317 / 31,771 | 21,183 / 36,051 |
| Cantidad | 2 | 20,156 / 26,866 | 21,366 / 28,142 |
| Precio | 1 | 22,235 / 30,611 | 24,275 / 29,016 |
| Precio | 2 | 21,055 / 29,055 | 22,320 / 28,585 |

Descripción tiene 72 muestras/bloque/variante, cantidad 32 y precio 28. Su
mediana aumenta 10,5% y 7,5% en descripción; la de precio aumenta 9,2% y 6,0%.
No se atribuye causalidad ni se descarta la señal como ruido. En 100 filas hay
mayor dispersión y los p95 de edición no mejoran consistentemente; el JSON
conserva los resultados completos. El `gate: true` de `timings.json` expresa
**sólo el umbral numérico de notas**, no una autorización de adopción.

Se conservaron 3.480 muestras: 696 warmup y 2.784 medidas, sin errores de página
ni intentos de red externa observados. React Profiler y contadores, en bundles
separados, atribuyen 14 ejecuciones de tabla y cada derivado para 14 caracteres
de notas en base, frente a cero en candidato, en las tres cargas. Tres caracteres
de concepto ejecutan tres veces esos trabajos en ambas variantes. No se usan
los tiempos de Profiler para las tablas anteriores.

El entorno completo consta en `timings.json`: Windows 11 x64, Ryzen 9 270,
16 CPU lógicas, 15,294 GiB y Chromium 156.0.8078.4. La ventana local estuvo
coordinada sin builds/tests pesados concurrentes de este plan; esto no certifica
aislamiento de todos los procesos del sistema operativo.

## Alcance y seguridad

La entrada independiente monta `DialogNuevaFacturaManual`,
`FacturaManualConceptosTable`, `useFacturaManualForm`, los inputs, el shell de
cancelación y el motor monetario reales. Genera 1, 20 o 100 conceptos sintéticos
deterministas, con IVA 16%, 8%, tasa cero, exento y no objeto. Sustituye únicamente
las fronteras de organización, catálogos/clientes, Banxico, envío y alerta de
crédito por adaptadores locales. No monta App, Auth, Sentry ni cliente backend;
no usa registros ni credenciales de clientes. Guardar/timbrar son no-op locales.
El informe de módulos falla si entran servicios, Auth, App o integraciones.
La configuración Vite usa `envDir: false` y no copia `public`.

Chromium de Playwright usa un perfil temporal propio, sin conectar con Chrome del
usuario. El servidor escucha sólo en `127.0.0.1`; CSP y rutas de Playwright
bloquean conexiones externas. La auditoría y las pruebas registran bloqueos y
errores. No se envía, guarda ni timbra ninguna factura.

`AGENTS.md`, `CONTRIBUTING.md`, arquitectura e instrucciones aplicables fueron
revisados. Este `main` no contiene `.agents/skills` ni instrucciones adicionales
en facturación. No se aplican las instrucciones del subárbol CRM.

## Hipótesis y candidato

Escribir notas cambia estado del hook y vuelve a ejecutar el diálogo, la tabla,
la validación `every`, el subtotal estimado y los totales. El candidato conserva
el formulario y sus handlers: `memo` a nivel módulo para la tabla; `useMemo` de
totales por `[conceptos, tasaIva]`; validación y subtotal estimado por
`[conceptos]`. No memoriza filas, no cambia claves, no virtualiza ni cambia la
aritmética. Se aplica en memoria al compilar la demo mediante `candidate.mjs`,
con comprobaciones de coincidencia única que fallan si cambia el código fuente.

## Método declarado antes de medir

Se compilan secuencialmente cuatro bundles: base/candidato de producción y sus
versiones de atribución. Sólo estas últimas contienen React Profiler y
contadores. Los bundles finales verifican que los contadores y el registro de
Profiler estén ausentes. React Profiler sirve únicamente para atribuir trabajo;
sus duraciones no se usan para aceptar el cambio.

Las mediciones finales usan el mismo proceso de Chromium, viewport 1280×720,
sin throttling y sin otras builds o pruebas concurrentes. Cada bloque contiene
un warmup descartado y cuatro rondas medidas; se alterna el orden base/candidato
en cada ronda y se invierte entre bloques. Cada carga empieza desde los mismos
conceptos. Se escriben, por teclado real, notas y después descripción, cantidad
y precio de la primera fila. La fila y el campo están enfocados y visibles antes
del intervalo; se comprueba que el foco se conserva.

Cada ronda navega y monta una página nueva: el warmup calienta navegador/cachés,
no garantiza JIT estable dentro de cada página. Base ya ejecutó la tabla al
escribir notas y candidato evitó ese trabajo; el calentamiento de la tabla antes
de editar conceptos puede diferir. Es el escenario solicitado (notas y después
conceptos), no una comparación aislada de edición en estado estable. Esa posible
explicación no demuestra la causa del aumento ni permite declarar no regresión.

Métrica primaria: delta de **CDP `TaskDuration` por pulsación**, en milisegundos.
Incluye trabajo de tareas del renderer entre snapshots, con script, estilo y
layout. Se espera a dos animation frames para dejar terminar actualizaciones.
No se añaden marcas, listeners ni wrappers a los componentes en esta medición.
`ScriptDuration` es diagnóstico secundario. `externalMs` incluye protocolo,
automatización y espera de frames; **ninguna de estas métricas demuestra
latencia usuario→pintura ni INP**. El coste residual del snapshot/espera es común
a ambas variantes y se conserva en las muestras.

Mediana: elemento central superior ordenado. p95: nearest rank
`ceil(n × 0.95) - 1`, sin eliminar outliers. Se conserva cada pulsación, su
bloque/ronda y warmup. El informe separa cargas, operaciones y bloques.

Umbral predeclarado: ahorro p95 en notas **≥20% y ≥5 ms en ambos bloques** para
20 conceptos. Esta carga es una aproximación sintética de demo, **no una
distribución observada de producción**. Un ahorro sólo en 100 filas no permite
adoptar. Las pruebas funcionales y monetarias deben pasar; cualquier resultado
que no justifique el cambio deja producto sin modificar.

## Reproducción

Desde la raíz del repositorio, con Node compatible, Bun y Chromium de Playwright:

```sh
bun --no-env-file install --frozen-lockfile --ignore-scripts
bun --no-env-file x playwright install chromium
node e2e/manual-invoice/run.mjs build
node e2e/manual-invoice/run.mjs functional
node e2e/manual-invoice/run.mjs profile
node e2e/manual-invoice/run.mjs measure
```

También se admite `node e2e/manual-invoice/run.mjs all`, siempre secuencial.
Para explorar la demo, después de compilar:
`node e2e/manual-invoice/run.mjs demo candidate 20` (también `base`, 1 y 100).
Abre exclusivamente Chromium de pruebas en modo visible y termina al cerrarlo.
`BENCH_BROWSER` permite indicar el ejecutable de Chromium de pruebas; no debe
apuntar al navegador/perfil del usuario. `run.mjs` sirve los bundles sólo durante
la prueba y cierra navegador y servidor al acabar. No se ejecuta la build de App.

En este host se usó Node 24.19.0, Bun 1.4.0 y el Chromium de pruebas ya instalado.
La instalación inicial de dependencias cargó automáticamente el `.env` versionado
del checkout por el comportamiento predeterminado de Bun; ningún valor fue
inspeccionado, usado en la demo ni publicado. La configuración aislada no carga
ese archivo. Los comandos reproducibles anteriores deshabilitan esa carga.

## Evidencia

- `build-audit.json`: SHA de base, hashes de fuentes/bundles y grafo de módulos.
- `attribution.json`: commits de React y ejecuciones de tabla/derivados.
- `functional.json`: comprobaciones base/candidato y oráculo Decimal independiente.
- `timings.json`: entorno, mediana/p95 por operación/carga/bloque y decisión del umbral.
- `samples.csv`: muestras crudas, incluidos warmups, sin datos de clientes.
- `validation.json`: verificación posterior de bundles y resumen de pruebas focales.

Después de iniciar la serie se añadieron sólo soporte de demo visible, salida
CSV, declaraciones TypeScript, export de la entrada, renombre `.tsx`→`.ts` de
los adaptadores sin JSX para cumplir lint y validaciones del harness. No se
cambió la lógica de tiempos ni el candidato. Tras la serie se recompilaron los
cuatro bundles: sus SHA256 son idénticos a los auditados antes de medir. Los
hashes de las tres fuentes se comprobaron antes y después. La verificación de
bundles/hashes del harness incorporada al runner es para futuras ejecuciones;
no se presenta como una comprobación automática previa que existiera en esta
serie. `validation.json` registra la comprobación posterior y sus límites.

Validación adicional: **13/13 pruebas existentes en cuatro suites focales**
(totales, cantidad fiscal, captura de seis decimales y dirty/reset), y ESLint
focal sin warnings. El primer intento de Vitest en sandbox no pudo leer dos
archivos de caché SSR temporal (sin fallos de aserciones); la repetición fuera
de ese sandbox pasó las cuatro suites. No se ejecutó suite completa, typecheck
completo, build de App, pruebas autenticadas ni backend. Los avisos de Vite sobre
el futuro `configLoader: native` y recomendación de plugin React no se cambiaron.

La prueba funcional compara cada importe por igualdad decimal exacta: redondeo
de base por fila, IVA por fila y suma de importes redondeados. Comprueba cinco
tratamientos IVA, frontera deshabilitada y filas heredadas de 8%, cantidades de
seis decimales, precio de cuatro decimales (contrato actual), moneda MXN/USD/EUR,
ediciones, agregar/quitar, protección de última fila, foco, continuar captura,
descarte con Escape y reset al reabrir. No afirma probar permisos, crédito,
persistencia, PAC o backend, que quedan fuera de esta demo.
