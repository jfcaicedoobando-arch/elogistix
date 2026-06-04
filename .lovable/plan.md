## Objetivo
Ajustar `vitest.config.ts` para que la suite completa (~289 archivos) no falle por timeout del sandbox.

## Cambio
En la sección `test` de `vitest.config.ts`, agregar:
```ts
testTimeout: 600_000,
```

## Justificación
- El sandbox tiene un límite máximo de 600s por ejecución.
- Actualmente no hay `testTimeout` configurado, lo que puede causar cortes prematuros.
- Con ~289 archivos de test, el tiempo por defecto (sin límite explícito) puede no ser suficiente.

## Validación
Tras el cambio, ejecutar `bunx vitest run` para confirmar que la suite completa arranca sin cortarse por timeout.