# Consulta: contrato de empaquetado Edge (solo lectura, sin cambios)

## Hechos verificados en el repositorio
- No existe ningún `deno.lock` en `supabase/` (ni raíz de funciones ni por función).
- No existe `import_map.json`; `supabase/config.toml` no declara import map ni lock.
- 9 funciones de correo tienen `deno.json` propio (p. ej. `supabase/functions/preview-transactional-email/deno.json`), que solo contiene `compilerOptions` (jsx, `jsxImportSource: npm:react@18.3.1`, types). Sin `imports`, sin `lock`, sin `nodeModulesDir`.
- Las demás funciones no tienen `deno.json`; el chequeo local resuelve `npm:` contra `node_modules` (regla ya en AGENTS.md).
- Versiones fijadas hoy por especificador en código: `npm:@react-email/components@0.0.22`, `npm:react@18.3.1`, y un import lateral `npm:react-dom@18.3.1` en `_shared/transactional-email-templates/send-email.ts`. El comentario ahí documenta un incidente previo: el peer `react-dom` de `@react-email/render@0.0.17` se resolvió a 19 en el despliegue. Eso es evidencia de que, en esa ruta, los transitivos no quedaron fijados por lock.
- Deno local del sandbox: 2.8.3. Es solo el entorno de chequeo, no prueba la versión del runtime de despliegue.

## Lo que NO puedo verificar
- Si el despliegue de Lovable Cloud lee `deno.lock` por función o respeta `--frozen`: la documentación oficial (docs.lovable.dev/features/edge-functions) no lo dice.
- Versión del runtime/bundler remoto, grafo resuelto, logs de bundling o hashes: no tengo acceso sin desplegar, y desplegar no está autorizado.
- Ni los tests locales ni `bun.lock` sirven como garantía de esto.

## Mecanismo compatible conocido (no garantizado)
- Lo que ya funciona en esta ruta y tiene evidencia en el repo es el pin explícito de especificadores de primer nivel e imports laterales de peers (`npm:pkg@x.y.z`). Con eso se fija la versión de un paquete que el grafo deduplica, pero no se garantiza para cualquier transitivo cuyo rango no admita esa versión.
- Para `@react-email/render` exactamente en 2.2.0: un import lateral `npm:@react-email/render@2.2.0` solo dedupe si el rango declarado (`>=2.2.0`) lo admite y el resolvedor elige la versión ya presente. No está verificado para este runtime.
- Un `deno.lock` por función o `imports`/`scopes` en `deno.json` podrían servir, pero no hay evidencia de que la ruta de publicación los consuma.

## Siguiente paso posible (solo si se autoriza)
- Ejecutar un despliegue de prueba de una función aislada y leer sus logs/grafo, o pedir a Lovable que confirme por escrito si respeta el lock. Nada de esto se ejecuta en esta consulta.
