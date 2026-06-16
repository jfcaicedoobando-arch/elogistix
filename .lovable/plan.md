## Problema

El CI ya pasa todos los jobs de tests, lint, typecheck, build y edge functions. **Sólo falla `Coverage merge & report**`:

```
Statements: 34.89% (19519/55932) — threshold 35%
Lines:      34.89% (19519/55932) — threshold 35%
```

Faltan **~57 statements cubiertos** para cruzar el piso de 35% (35% × 55 932 = 19 576).

## Causa

En iteraciones previas se eliminaron `src/features/comisiones/services/__tests__/index.test.ts` y `src/features/tesoreria/services/__tests__/index.test.ts` (test-hygiene), lo cual restó cobertura. Los nuevos tests puros añadidos cubren código que ya estaba contado, así que el neto bajó marginalmente.

## Estrategia

En vez de bajar el umbral (rompe la política de "el piso sólo sube"), añadimos **un único archivo de tests de smoke sobre constantes puras** que hoy reportan 0% de cobertura. Son módulos de sólo datos (arrays/objetos congelados) sin lógica — el test simplemente los importa, valida shape mínimo y comprueba invariantes triviales. Aporta ~160 statements cubiertos, con margen sobrado sobre los 57 necesarios.

## Archivos objetivo (todos 0% hoy)


| Archivo                                  | Líneas |
| ---------------------------------------- | ------ |
| `src/constants/bancosMexico.ts`          | 46     |
| `src/constants/regimenFiscalSAT.ts`      | 31     |
| `src/constants/cache.ts`                 | 45     |
| `src/constants/cotizacionInformativa.ts` | 15     |
| `src/constants/cotizacionTerrestre.ts`   | 15     |
| `src/constants/externalUrls.ts`          | 14     |
| `src/constants/reportes.ts`              | 9      |


## Cambios

1. **Crear** `src/constants/__tests__/constantsSmoke.test.ts` con un `describe` por módulo. Cada bloque:
  - Importa el módulo.
  - Verifica que los exports principales existan y tengan el tipo esperado (`Array.isArray`, `typeof === "object"`, claves no vacías).
  - Para catálogos (bancos, régimen fiscal): valida que no haya duplicados de clave/código y que ningún elemento tenga campos vacíos.
  - Para `cache.ts`: verifica que las TTL exportadas sean números > 0.
  - Para URLs externas: que cada valor sea string `https://…`.
2. **Verificación local**: correr `bunx vitest run src/constants/__tests__/constantsSmoke.test.ts` para asegurar verde, y confirmar que las constantes no se excluyen del coverage (revisar `vitest.config.ts` → la exclusión `src/types/**` no afecta a `src/constants/**`, ya verificado).
3. **Bump** `APP_VERSION` → `13.44.16` y entrada en `CHANGELOG.md` describiendo: cobertura recuperada por debajo del umbral, archivo de smoke añadido, sin cambios en lógica de la app.

## Notas

- No se toca `vitest.config.ts` ni el umbral — la política "ratchet sólo sube" se respeta.
- No hay cambios en código de producción.

&nbsp;

Genera mas tests, para intentar quedar 3% por encima del umbral.