# Limpieza Knip: grupo financiero (2026-10-16)

Base aislada: `main` en `b500565363af0fc566decb7327c717da61cfabd7`,
confirmada mediante `git ls-remote origin refs/heads/main` antes de editar.
Remoto: `https://github.com/jfcaicedoobando-arch/elogistix.git`.
Se leyó `AGENTS.md`. Este checkout no contiene `.agents/skills` ni instrucciones
anidadas aplicables a los archivos asignados.

## Reproducción

- Bun **1.4.0**, Node **24.22.0**, Knip **6.41.0**.
- Instalación: `bun install --frozen-lockfile --ignore-scripts` (752 paquetes,
  exit 0). Manifiestos y lock sin cambios.
- Inventario: `node node_modules/knip/bin/knip.js --no-progress --reporter json`.
- `before.stdout.txt` y `after.stdout.txt` son salidas JSON sin modificar.
  Los archivos `*.result.json` guardan comando, horas UTC y resultado;
  `*.stderr.txt` conserva el diagnóstico separado.
- El inventario previo coincide con
  `../knip-scoped-cleanup-20261016/after.json`, incluidos archivo, símbolo,
  línea, columna y posición. Se restauraron los bytes LF originales del clone
  antes de medir; `git diff` y el índice estaban vacíos antes de la limpieza.
- La caché de instalación vive fuera del checkout: una caché situada dentro
  del repo introduce sus propios tests en el descubrimiento de Knip. Ninguna
  configuración ni severidad se modificó para evitarlo.

## Investigación y decisiones

La búsqueda fue local sobre el repositorio completo mediante `git grep -n -I`,
por símbolo, rutas, barrels, namespaces e imports dinámicos; no se usó el índice
de GitHub como prueba de ausencia. `references-before.txt` registra los símbolos
y `discovery-before.txt` los mecanismos de descubrimiento. No hay un loader de
producción `import.meta.glob`/`require.context` para estos módulos. Las referencias
de `fast-glob` corresponden a auditorías y pruebas de arquitectura.

Rutas de la tabla relativas a `src/features/`:

| Aviso retirado | Decisión y contrato conservado |
| --- | --- |
| `cxp/services/index.ts`: `cargoEnMxn` | Quitar sólo reexport. `pagoProveedorBitacora.ts` importa la implementación de `pagoProveedorMovimiento.ts` directamente. |
| Mismo barrel: `cargoEnMonedaCuenta`, `ERROR_TC_REQUERIDO` | Quitar sólo reexports. Canónicos, usos internos y pruebas directas siguen intactos. |
| `cxp/services/facturasEntrantes.ts`: `subirFacturaEntrante` | Quitar reexport. Se conserva `facturasEntrantesUpload.ts`, incluido el import dinámico de su test; UI sigue usando `subirFacturaEntranteConResultado`. |
| `cxp/services/proveedorFacturas.ts`: tipo `NuevaFacturaProveedorPayload` | Quitar reexport. Su definición canónica en `.crud.ts` sigue formando `CrearFacturaProveedorInput`. |
| `embarques/domain/embarqueWizardSchemas.ts`: `STEP_LABELS` | Quitar reexport y comentario obsoleto. `appFeedback.ts` consume directamente `embarqueWizardConstants.ts`. |
| `embarques/hooks/useDialogGenerarProformaController.helpers.ts`: `ivaDeFila` | Quitar import/reexport sin uso interno. Dominio fiscal y consumidores directos intactos. |
| `embarques/services/contenedores/index.ts`: `sincronizarContenedores` | Quitar reexport. Canónico `crud.ts` y pruebas directas intactos. El namespace de queries no accede al símbolo; el mock residual no es consumidor. |
| `embarques/domain/estadosContables.ts`: `esEstadoEmbarqueContable` | Retirar función sin referencias, incluida búsqueda dinámica. Conservar exactamente `ESTADOS_EMBARQUE_NO_CONTABLES`, usado por `proyeccion/fetchSources.ts` y `profit/services/estadoResultados.ts`. |
| `facturacion/services/facturapi.ts`: `FacturaConRepsVivosError` | Quitar sólo reexport. Clase canónica y `assertSinRepsVivos` quedan byte por byte intactos. |
| `facturacion/services/timbradoPendiente.ts`: `esRespuestaPendiente` | Retirar alias sin consumidores y su import de valor. `esPendienteWire` en `timbradoWire.ts`, su consumo por `timbradoParse.ts` y sus pruebas no cambian. |
| `tesoreria/domain/libroPagos.ts`: `TIPO_PAGO_LABELS` | Quitar sólo reexport. Conservar import y uso en `etiquetaTipoPagoLibro`. |
| `tesoreria/domain/tolerancia.ts`: `TOLERANCIA_MONTO_MXN`, `TOLERANCIA_MONTO_POR_MONEDA` | Quitar sólo reexports; canónicos de `lib/domain/tolerancia.ts` y consumidores financieros conservados. |
| `tesoreria/hooks/useTraspasoForm.ts`: tipo `TraspasoFormState` | Quitar sólo reexport; definición y validación del dominio intactas. |
| `proformas/components/ProformaEstadoBadges.tsx`: tipo `OrigenAceptacion` | Quitar sólo reexport; import interno y definición/derivación canónicas intactos. |

El único test editado es `cxp/services/__tests__/pagosProveedor.rpcBoundary.test.ts`:
su guard deja de exigir tres reexports de compatibilidad y exige ausencia de
reexports de `pagoProveedorMovimiento`. Conserva todos los casos, payloads,
aserciones de RPC y ausencia de escrituras directas; no reduce aserciones.

Una revisión independiente del diff no encontró hallazgos accionables. No se
modifican permisos, comportamiento financiero, contratos usados, SQL, workflows,
manifiestos, lock ni configuración Knip. No se ejecutan conexiones de BD ni
acciones fiscales; las pruebas de servicios usan mocks.

## Validación y límites

Medición original sobre `b5005653`, antes de integrar el grupo comercial:

| Inventario | Antes | Después |
| --- | ---: | ---: |
| Exports | 42 | 29 |
| Tipos | 22 | 19 |
| Total | 64 | 48 |
| Grupo financiero | 16 | 0 |

No aparecen avisos nuevos; los 48 restantes pertenecen a otros grupos. El
inventario JSON previo y posterior sale con código 0. Build: código 0.
Pruebas focales: **34 archivos y 273 tests aprobados**, código 0.
Tipos (`bun run typecheck`) y gate normal (`bun run lint:unused`): código 0.
Lint completo con cero warnings (`bun run lint -- --max-warnings=0`): código 0.

Los resultados y el delta estructurado se registran en `comparison.json` y los
archivos de evidencia de este directorio. El gate normal se ejecuta sin flags de
supresión. Tipos: `bun run typecheck`; lint: `bun run lint -- --max-warnings=0`;
build: `bun run build`; pruebas focales: comando completo en `focused.result.json`.

La ejecución local usa PATH con las versiones fijadas y un temporal del checkout.
El proceso de build elimina `SENTRY_AUTH_TOKEN`, usa `ANALYZE=false` y
`CI_REPORT_COMPRESSED_SIZE=false`; no sube sourcemaps. No se repite localmente la
suite completa afectada por fallos conocidos de Bash/symlinks en Windows. La CI
Linux del PR sobre su SHA exacto proporciona la validación completa.

Límite de la prueba existente `facturapi.test.ts`: su mock no ofrece
`supabase.from`, por lo que no demuestra el bloqueo cuando hay REP vivos. Esta
limpieza sólo retira el reexport; la clase, consulta, cantidad, code y llamada
`assertSinRepsVivos` no se modifican. No se atribuye esa cobertura al test.

El PR se mantiene draft; no se fusiona ni despliega desde este hilo.

## Integración del main comercial

Por instrucción posterior se integró `main` en
`c1d86c349b80faa7489d250440924ea77848c57d` (PR comercial #383), mediante merge
`f505e171c18e27fb3e127ad40a79faa989a7b121`. No hubo conflictos ni ediciones
manuales de archivos comerciales. Se leyó también `src/features/crm/AGENTS.md`.

`integration-comparison.json` confirma que el diff binario de `src/` entre
`c1d86c3` y la rama integrada es idéntico al diff financiero original entre
`b5005653` y `1bdd40842`. SHA-256 de ese diff:
`4c2136447292871527efbff2c56a33586a91688ddeac690929893f093c0165c2`.
El único cambio propio adicional es esta documentación y su evidencia de
integración.

| Inventario sobre main comercial | Main comercial | Combinación financiera |
| --- | ---: | ---: |
| Exports | 26 | 13 |
| Tipos | 16 | 13 |
| Total | 42 | 26 |
| Grupo financiero | 16 | 0 |

La combinación coincide exactamente por archivo/tipo/símbolo con el inventario
comercial menos los 16 avisos financieros documentados; no hay avisos nuevos.
Los archivos `integrated-*.result.json`, `integrated-*.stdout.txt` y
`integrated-*.stderr.txt` registran las validaciones repetidas con las mismas
versiones fijadas. El estado final de CI se informa en la descripción del PR
sobre el SHA final, sin confundirlo con la CI del commit previo a la integración.

Resultado local integrado: Knip JSON, gate normal, tipos, lint con cero warnings,
build y las mismas **34 suites / 273 tests** aprobados; todos salen con código 0.
