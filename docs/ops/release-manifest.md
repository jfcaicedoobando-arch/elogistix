# Manifest de migraciones por release

## Qué problema resuelve

`APP_VERSION` es la etiqueta de release que ven los usuarios y la operación, pero
hasta ahora no existía una forma de saber, para una versión dada, **qué set de
migraciones SQL debía estar incluido**. Eso permite errores como:

- Subir una versión sin las migraciones que la acompañan.
- Agregar migraciones a una release ya etiquetada sin incrementar la versión.
- Commitear una versión nueva pero olvidar el conjunto de migraciones que la
  define.

El manifest resuelve eso: es un JSON que, para cada `APP_VERSION`, guarda la
lista ordenada de archivos de migración que la conforman.

## Archivos

- `supabase/releases/migration-manifest.json` — manifest canónico.
- `scripts/db/release-manifest.ts` — generador y verificador.
- Job de CI: `.github/workflows/release-compatibility.yml`.

## Flujo local

Cuando un PR modifica `supabase/migrations/` o cambia `APP_VERSION`, regenera
el manifest:

```sh
bun run db:release-manifest:update
git add supabase/releases/migration-manifest.json
```

Verifica sin tocar el archivo:

```sh
bun run db:release-manifest:check
```

## Reglas de la pipeline

1. **Si cambia el set de migraciones, `APP_VERSION` debe subir.** La pipeline
   compara la versión del PR con la versión de la rama base (`main`); si son
   iguales y hay migraciones nuevas/modificadas, falla con instrucciones claras.
2. **El manifest debe existir para `APP_VERSION`.** Si la versión actual no tiene
   entrada, la pipeline falla pidiendo `bun run db:release-manifest:update`.
3. **El manifest debe coincidir exactamente con el directorio.** Si faltan o
   sobran migraciones respecto a la entrada, falla con la lista de diferencias.

## Primera generación

El manifest se genera con el script local; no se requiere Docker ni Postgres. Si
un PR lo introduce, el job de CI solo verifica que el archivo generado sea el
correcto.
