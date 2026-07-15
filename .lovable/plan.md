## Diagnóstico

El log corresponde al workflow **CodeQL** (no a tests ni build de la app). La causa raíz aparece temprano:

```
git call failed. Cannot fetch main. Error: fatal: error processing shallow info: 4
```

Y termina fallando así:

```
ERROR: In extension for codeql/util:restrictAlertsTo, row 6 is invalid.
Found '"undefined", "undefined", "undefined"' ...
A fatal error occurred: A 'codeql resolve extensions-by-pack' operation failed with error code 2
##[error]Error running analysis for javascript ...
```

Analogía: CodeQL intenta escanear **sólo los archivos que cambiaron en este PR** (modo "PR diff range"). Para saber cuáles cambiaron, necesita comparar tu rama contra `main`. Pero `actions/checkout` hace un clon "superficial" (sólo el último commit), así que no encuentra `main` para comparar. Sin diff, escribe `undefined` en la lista de archivos y el motor revienta.

Esto **no es un bug de nuestro código** — es configuración del workflow.

## Cambio propuesto

Un único archivo: `.github/workflows/codeql.yml`, paso `Checkout`. Pedirle a `actions/checkout` que traiga historial completo para que CodeQL pueda calcular el diff contra `main`.

```yaml
- name: Checkout
  uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3
  with:
    fetch-depth: 0
```

Es el fix estándar y recomendado por GitHub para este error.

## Verificación

- No requiere cambios en código de app, ni tests, ni versión (`APP_VERSION`), ni CHANGELOG (es infraestructura de CI, no funcionalidad del usuario).
- El próximo run del workflow CodeQL sobre este PR debe pasar la fase de resolución de diff-range y completar el análisis.

## Alternativa (si no quieres traer todo el historial)

Usar `fetch-depth: 50` o similar suele bastar para PRs pequeños, pero `0` es el más robusto y es lo que la documentación oficial de CodeQL sugiere cuando aparece este error específico.
