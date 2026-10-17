# Evidencia completa legible como texto

Esta carpeta presenta **todo** el contenido textual del ZIP de auditoría para
revisores que no pueden abrir binarios mediante el conector de GitHub. No añade
una suite automática ni cambia el código probado o sus resultados. El ZIP
original permanece intacto, SHA256
`55d27ad4da2bfe8c83b11ec846c5d1affe0f3a497e1b1f21b7fdcb93a8eddbac`.

## Fuentes completas

- [Contrato del handler real](handler_contract_test.ts.txt).
- [Contrato de resolución/export npm](cors_resolution_test.ts.txt).
- [Expectativas independientes de headers y ocho templates](expected.ts.txt).
- [Asserts usados por ambos contratos](assertions.ts.txt).
- [Runner exacto de Deno, entorno mínimo y captura de códigos/logs](run-deno.mjs.txt).
- [Verificación y construcción del resumen](build-summary.mjs.txt).
- [Inspección inicial del paquete publicado](inspect-package.mjs.txt).
- [Módulo CORS publicado](cors-published.mjs.txt).
- [Index original](source/reference-index.ts.txt) e
  [index con pin](source/candidate-index.ts.txt).

El sufijo `.txt` identifica **copias documentales** del código del harness
manual ya ejecutado, con el nombre original conservado completo. Para reproducir,
restaurar los nombres originales en un directorio externo de la tarea y seguir
los [comandos completos](archive-README.md). No se incorporan como tests nuevos
al catálogo ni se altera un carril existente. No se cambió código para esta
presentación; las fuentes únicamente normalizan CRLF a LF. Las copias de logs
también recortan espacios finales y líneas vacías finales del formato de terminal,
sin eliminar diagnósticos ni resultados. Los bytes originales permanecen en el ZIP.

## Comandos, códigos y logs originales

| Etapa | Comando/exit code/hashes | stdout completo | stderr completo |
| --- | --- | --- | --- |
| Referencia handler | [execution](reference-final.execution.json) | [stdout](reference-final.stdout.txt) | [stderr](reference-final.stderr.txt) |
| Candidato handler | [execution](candidate-final.execution.json) | [stdout](candidate-final.stdout.txt) | [stderr](candidate-final.stderr.txt) |
| Resolución/export | [execution](resolution-final.execution.json) | [stdout](resolution-final.stdout.txt) | [stderr](resolution-final.stderr.txt) |
| Typecheck explícito | [execution](candidate-check.execution.json) | [stdout](candidate-check.stdout.txt) | [stderr](candidate-check.stderr.txt) |
| Check desde raíz | [execution](candidate-ci-check.execution.json) | [stdout](candidate-ci-check.stdout.txt) | [stderr](candidate-ci-check.stderr.txt) |
| Deno lint | [execution](candidate-lint.execution.json) | [stdout](candidate-lint.stdout.txt) | [stderr](candidate-lint.stderr.txt) |
| Grafo referencia | [execution](reference-info.execution.json) | [stdout](reference-info.stdout.txt) | [stderr](reference-info.stderr.txt) |
| Grafo candidato | [execution](candidate-info.execution.json) | [stdout](candidate-info.stdout.txt) | [stderr](candidate-info.stderr.txt) |
| Adquisición de caché | [execution](reference-cache.execution.json) | [stdout](reference-cache.stdout.txt) | [stderr](reference-cache.stderr.txt) |
| Typecheck corregido de referencia | [execution](reference-check-fixed.execution.json) | [stdout](reference-check-fixed.stdout.txt) | [stderr](reference-check-fixed.stderr.txt) |
| Fallo inicial HeadersInit | [execution](reference-check.execution.json) | [stdout](reference-check.stdout.txt) | [stderr](reference-check.stderr.txt) |
| Fallo inicial descriptor serve | [execution](reference-handler-first.execution.json) | [stdout](reference-handler-first.stdout.txt) | [stderr](reference-handler-first.stderr.txt) |
| Fallo inicial alcance de lectura | [execution](reference-handler-serve-fixed.execution.json) | [stdout](reference-handler-serve-fixed.stdout.txt) | [stderr](reference-handler-serve-fixed.stderr.txt) |
| Fallo inicial entorno de dependencias | [execution](reference-handler-source-read.execution.json) | [stdout](reference-handler-source-read.stdout.txt) | [stderr](reference-handler-source-read.stderr.txt) |

También están los grafos [referencia](reference-info.stdout.txt) y
[candidato](candidate-info.stdout.txt), sus comandos/hashes, adquisición separada
de caché, [resolución final](resolution.json), [proveniencia del runtime copiado](runtime-provenance.json)
y los cuatro fallos iniciales con sus códigos/logs completos. No se elimina ni
convierte un fallo en un resultado aprobado.

## Respuestas sin truncar

Los JSON originales de cada ejecución miden aproximadamente 435 KB. Para que
el conector pueda leerlos completos se dividen sin pérdida en metadatos y un
archivo por escenario. Cada archivo de respuesta conserva `status`, todos los
headers y el **body literal completo**, incluido el HTML de las ocho plantillas.
El mayor archivo de evidencia mide 71.859 bytes.

- [Metadatos referencia](reference/metadata.json),
  [OPTIONS sin key](reference/responses/optionsWithoutKey.json),
  [key ausente](reference/responses/missingKey.json),
  [key vacía](reference/responses/emptyKey.json),
  [OPTIONS token incorrecto](reference/responses/optionsWithWrongToken.json),
  [token ausente](reference/responses/missingToken.json),
  [token incorrecto](reference/responses/wrongToken.json),
  [POST válido y ocho renders](reference/responses/validPost.json),
  [Bearer minúsculas](reference/responses/lowercaseBearer.json),
  [GET](reference/responses/validGET.json), [PUT](reference/responses/validPUT.json),
  [PATCH](reference/responses/validPATCH.json), [DELETE](reference/responses/validDELETE.json).
- [Metadatos candidato](candidate/metadata.json),
  [OPTIONS sin key](candidate/responses/optionsWithoutKey.json),
  [key ausente](candidate/responses/missingKey.json),
  [key vacía](candidate/responses/emptyKey.json),
  [OPTIONS token incorrecto](candidate/responses/optionsWithWrongToken.json),
  [token ausente](candidate/responses/missingToken.json),
  [token incorrecto](candidate/responses/wrongToken.json),
  [POST válido y ocho renders](candidate/responses/validPost.json),
  [Bearer minúsculas](candidate/responses/lowercaseBearer.json),
  [GET](candidate/responses/validGET.json), [PUT](candidate/responses/validPUT.json),
  [PATCH](candidate/responses/validPATCH.json), [DELETE](candidate/responses/validDELETE.json).

[text-manifest.json](text-manifest.json) mapea los 61 archivos del ZIP, incluido
su manifiesto, a estas presentaciones textuales con hashes y tamaños originales
y normalizados. Para cada ejecución incluye orden de escenarios, rutas de todos
los JSON y fórmula de reconstrucción. Se comprobó que reunir metadatos y casos
con `JSON.stringify(..., null, 2) + '\n'` reconstruye ambos originales **byte a
byte** y sus SHA256. No se omiten, resumen ni vuelven a renderizar respuestas.

[archive-manifest.json](archive-manifest.json) conserva los hashes originales;
[summary.json](summary.json) mantiene el resumen previamente publicado. Las
normalizaciones de formato de las copias documentales están registradas por archivo
y separadas de los hashes del registro original. La evidencia sigue acreditando CLI local,
sin afirmar estado desplegado. Esta adición no requiere ejecutar otra vez el
handler porque fuentes y resultados probados permanecen iguales.
