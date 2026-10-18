# Evidencia consolidada de integraciones Tailwind

No se publican bundles completos de producto. Los outputs completos permanecen en el directorio local reports; este archivo conserva inventarios y metadata verificables.

`summary.json` es una copia exacta del resumen original. Sus rutas reports/ describen la ejecución local; `index.json` las relaciona con los archivos archivados.
Los logs originales están en `execution/`, las configuraciones en `execution/config/` y las capturas de fuentes en `execution/sources/`.
Los inventarios y metadata idénticos comparten `objects/<sha256>.json`. Se conservan sus bytes originales, sin normalizar rutas ni asumir igualdad por variante.
Las capturas de fuentes se conservan completas y byte a byte; sus timestamps distintos no se eliminan para forzar deduplicación.

Serie: 13 pares; 3 iniciales retenidos y 10 repetidos. La consolidación ocurre después de los intervalos medidos.
Se verificaron todos los recursos raw JS/CSS locales contra los inventarios. No se repitieron Brotli/gzip ni el conteo de reglas; se cotejaron con el compression-cache original y su hash.

Para verificar el archivo sin los bundles locales:

```powershell
node RUTA_AL_CONSOLIDADOR/consolidate-tailwind-builds.mjs --verify RUTA_A_ESTA_CARPETA
```

`archive-manifest.json` contiene bytes y SHA256 de cada archivo publicado, incluidos summary, index, logs, configuración, sources y objetos. `archive-manifest.sha256` permite comprobar el propio manifiesto; estos hashes verifican integridad, no constituyen una firma independiente.
