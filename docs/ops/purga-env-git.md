# Higiene de archivos de entorno

Revisado el **2026-09-26** a nivel de inventario Git.
`.gitignore` excluye `.env`/`.env.*` salvo `.env.example`,
pero un archivo ya trackeado no sale del índice por añadir esa regla.

## Clasificar primero

Revisar nombres de variables y su uso, sin imprimir valores.
Claves publicables/URLs/DSN de ingesta pueden ser públicas; service-role,
passwords y API keys privadas no lo son. La revisión de 2026-08-29 era una
fotografía de ese contenido, no una garantía del historial completo.

Si aparece una credencial privada en Git, rotarla en el proveedor y actualizar
entornos antes de tratar la historia. Borrar un archivo no revoca un secreto.

## Opciones

- Dejar de trackear `.env`: cambio separado, conservar archivo local y revisar
  cómo Lovable/build obtiene sus variables antes de aplicar.
- Purga histórica: opcional y **requiere autorización/coordinación específica**,
  respaldo y plan para clones/forks/tags. No force-push como limpieza rutinaria.
- Reescribir historia no es necesario sólo porque existan variables públicas.

## Comprobar sin mutar

```bash
git ls-files -- .env
git log --oneline --all -- .env
git check-ignore -v --no-index .env
```

No ejecutar recetas de filter-branch/filter-repo o pushes forzados desde esta
guía sin el plan aprobado. Esta limpieza no modificó `.env`, permisos ni Git histórico.
