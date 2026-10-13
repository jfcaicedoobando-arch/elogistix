# Cobertura de secretos en merges

`gitleaks.yml` conserva el escaneo histórico y agrega un suplemento obligatorio
del contenido final cambiado. No cambia permisos, `.gitleaks.toml`, la política
de credenciales del checkout ni los eventos del workflow.

## Motivo

El action fijado a `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`
construye el rango de PR con `--no-merges --first-parent`; su consulta de commits
tampoco pagina. Un head de integración puede dar cero commits y cero bytes aunque
el diff tenga contenido. `BASE_REF` no cambia esas opciones. Un push con un único
merge usa `-1`, sin habilitar los diffs de merge.

El suplemento usa el CLI **8.24.3**, instalado por el mismo action, sin una
segunda descarga ni inputs no soportados. No sustituye el escaneo histórico.

## Qué comprueba

- PR: merge-base entre los SHA base/head del evento y el head real del PR.
  No depende de la lista API de commits ni del checkout de merge sintético.
- Push: `before` contra `after`; creación de rama con `before` cero: árbol final.
- Dispatch: árbol completo del SHA seleccionado.
- Copia los blobs finales añadidos/modificados; un rename se trata como
  eliminación más adición para escanear el destino completo.
- Valida SHA/objetos, diff, lista NUL y número/tamaño de archivos materializados.
  Un fallo de Git o una selección vacía inconsistente bloquea, sin fallback vacío.
- Escanea desde la raíz temporal con rutas relativas y la configuración exacta
  del head. Conserva los patrones existentes, incluido `^\.env$`, y el fichero de
  ignores si existe. No escribe en el checkout ni en sus objetos Git.
- Construye un repositorio bare temporal con un único commit raíz de esos blobs.
  `fast-import` usa longitudes explícitas y nombres con quoting C/octal; comprueba
  identidad exacta de rutas, modos y blobs antes de escanear. No usa filtros clean,
  hooks, firma, alternates ni objetos del repositorio original para escribir.
  Los subprocesos eliminan redirecciones heredadas `GIT_*` y desactivan config
  global/sistema para que no cambien el destino del índice, repositorio u objetos.
- Una sola invocación del CLI escanea el parche raíz con `--root --text`, sin
  ext-diff ni textconv. Así una carpeta llamada `pdf` no es podada por una regla
  de sufijo, y atributos de binario no ocultan texto. Las rutas no son argumentos
  del shell. Las exclusiones de archivos de `.gitleaks.toml` siguen vigentes.
- Los symlinks se convierten en texto literal de su destino; nunca se siguen.
  Los gitlinks/submódulos cambiados bloquean para revisión separada.
- Solo registra SHA, cantidades, bytes y códigos de salida. No publica
  contenido, hallazgos, rutas de archivos ni reportes; usa `--redact=100`.
  Los temporales se eliminan tanto en éxito como en error.

Un diff vacío verificado, eliminaciones sin contenido restante o archivos de
cero bytes se registran explícitamente. Un snapshot no vacío debe obtener una
respuesta válida del scanner: exactamente un commit y una cantidad positiva de
bytes. Gitleaks 8.24.3 cuenta bytes del parche antes de aplicar las exclusiones de
ruta, por lo que esto también vale para un `.env` permitido. No se reimplementan
los patrones en Python. Estas cifras miden entrada, no bytes sometidos a todas
las reglas después de aplicar allowlists.

## Pruebas

Sin instalar herramientas:

```sh
python3 -m unittest discover -s scripts/ci -p test_gitleaks_snapshot.py -v
```

Los contratos offline usan repositorios Git efímeros y un doble de scanner:
merge-only, push de merge, más de 30 commits, head exacto, rename, rutas con
tabuladores/saltos de línea, vacío, eliminaciones, binarios/allowlist, symlinks,
submódulos, SHA inválido, materialización incompleta, framing de blobs arbitrarios,
identidad del snapshot, cobertura de un commit y errores sanitizados.

En CI se exige el binario real instalado por el action. Los controles adicionales
usan una regla sintética y un token ficticio: documento limpio, token añadido
solamente en el merge, `.env` permitido, rename fuera de la allowlist y archivo
bajo una carpeta cuyo nombre coincide con un sufijo permitido, atributos de
binario y nombres que requieren quoting Git. El modo
obligatorio falla si falta el binario; no puede omitir silenciosamente esos casos.

## Límites

El suplemento acredita el estado final de los archivos cambiados. No resuelve
por sí solo secretos introducidos y borrados en commits intermedios que el action
histórico omita, ni escanea contenido de submódulos o archivos excluidos.
El scan completo manual usa una sola invocación del CLI; su tiempo real sigue
pendiente de medición en Actions y conserva el timeout bloqueante de diez minutos.
Los ignores vinculados a un SHA histórico no equivalen a un ignore de snapshot.
No interpreta un verde previo como validación de otro SHA, no ejecuta despliegues
y no toca bases de datos ni secretos del entorno.

Fuentes oficiales fijadas:

- [Rango y exportación del binario del action](https://github.com/gitleaks/gitleaks-action/blob/e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e/src/gitleaks.js)
- [Versión por defecto y selección de eventos](https://github.com/gitleaks/gitleaks-action/blob/e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e/src/index.js)
- [CLI y redacción de Gitleaks 8.24.3](https://github.com/gitleaks/gitleaks/blob/v8.24.3/README.md)
- [Parches y cobertura del scanner Git](https://github.com/gitleaks/gitleaks/blob/v8.24.3/detect/git.go)
- [Framing y rutas de fast-import](https://git-scm.com/docs/git-fast-import)
