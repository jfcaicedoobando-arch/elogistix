## Diagnóstico

El fallo no es de las pruebas RLS: es del propio guard de CI.

En `.github/workflows/rls-tests.yml` la lista de suites existe **dos veces**:

- Líneas 91–111: lista escrita a mano dentro del paso "Validate matrix covers every test_rls_*.sql".
- Línea 242–262: la matriz real (`matrix.suite`) que sí ejecuta las pruebas.

La matriz real ya incluye `soft_delete_rpcs` (línea 261) y el archivo `supabase/tests/rls/test_rls_soft_delete_rpcs.sql` existe. Lo que falta es esa entrada en la lista copiada del guard, por eso el diff falla.

Analogía: es como un inventario con dos hojas; la bodega y la hoja buena coinciden, pero la fotocopia vieja no, y el auditor compara contra la fotocopia.

## Cambio propuesto

Eliminar la duplicación en vez de solo parchar la lista: el guard leerá las suites directamente del bloque `matrix.suite` del mismo archivo.

1. Reemplazar el bloque `declared=$(printf '%s\n' ... )` por una extracción del YAML:
   - Localizar la línea `suite:` dentro de `strategy.matrix` y tomar los ítems `- <nombre>` siguientes hasta que termine la lista.
   - Ordenar con `LC_ALL=C sort` igual que `expected`.
2. Añadir una validación de seguridad: si la extracción devuelve 0 elementos, fallar con un mensaje claro (para que un cambio de formato del YAML no deje el guard silenciosamente inútil).
3. Mantener el mismo mensaje de error y el resumen final `✓ matrix.suite cubre N suites`.

Con esto, agregar un nuevo `test_rls_*.sql` solo requiere registrarlo en un lugar (`matrix.suite`), y el guard sigue fallando si se olvida.

## Detalles técnicos

- Solo se modifica `.github/workflows/rls-tests.yml` (paso de validación, líneas ~86–120).
- Extracción con `awk` sobre el propio workflow, sin dependencias nuevas (nada de `yq`).
- Se respeta `set -euo pipefail` y el estilo ShellCheck ya aplicado en este workflow (comillas en variables, sin `echo` de listas sin comillas).
- Verificación local: ejecutar el mismo snippet en el sandbox y confirmar que `expected` y `declared` (20 suites, incluida `soft_delete_rpcs`) quedan idénticas.
- Al terminar: bump de `APP_VERSION` y entrada en `CHANGELOG.md` según la convención del proyecto.
