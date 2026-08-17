# Parches 17, 18 y 19 — revisión y aplicación

## Veredicto corto

Sí, son buena idea: son ajustes visuales y de formato pequeños, retro-compatibles, sin lógica de negocio. Verifiqué cada parche contra el código actual con una simulación (sin escribir nada):

| Parche | Estado | Nota |
|---|---|---|
| patch-17 (formatos) | Aplica limpio | 13 archivos |
| patch-18 (sidebar / usuarios / configuración) | Aplica limpio | 11 archivos, incluye edge function |
| patch-19 (navegación / tesorería) | Aplica con 1 excepción | el bloque de tesorería VT-12 ya está hecho |

## Ajustes necesarios al aplicar

1. **VT-12 (columna "Neto" en Flujo esperado 30 días) ya existe** en `TesoreriaFlujoMonedas.tsx`: ya tiene encabezado "Neto" y celda propia alineada a la derecha. Ese trozo del parche 19 se omite; el resto del parche 19 sí entra.
2. **Power of 10**: `Cotizaciones.tsx` hoy tiene 198 líneas y el parche 19 le suma ~29 (el banner explicativo cuando se llega desde `/embarques/nuevo`). Pasaría de 200 líneas y rompería CI. Se extrae el banner a un componente hermano (`CotizacionesBannerOrigen.tsx`) y la ruta solo lo invoca.
3. **Efecto global del breadcrumb (VB-24)**: el parche antepone "Inicio" en todas las pantallas de primer nivel, no solo Bitácora. Es coherente y lo dejo así, pero es un cambio visible en todo el ERP.
4. **Edge function**: el parche 18 modifica `user-management` (agrega `full_name` al listado). Requiere redespliegue de la función para que el fallback de `/usuarios` funcione.

## Qué se ve distinto para el usuario

- Fechas de auditoría y vigencias de costeo con año de 4 dígitos y formato único DD/MM/YYYY.
- Guion largo "—" homologado en celdas vacías de embarques y dashboard.
- Buscador de embarques más ancho (sin texto truncado) e icono de alerta de login centrado.
- Sidebar: versión copiable con tooltip y el badge rojo de Embarques explica qué cuenta.
- `/usuarios`: si el directorio no responde, muestra el nombre en vez de "?", y contador "N activos".
- `/configuracion`: encabezados de sección con icono consistente.
- Bitácora: sin controles de paginación cuando hay una sola página; breadcrumb "Inicio › Bitácora".
- `/embarques/nuevo`: banner que explica por qué manda a Cotizaciones.
- Libro de pagos: columnas con encabezado y tipo legible.

## Pasos técnicos

1. Aplicar patch-17 completo.
2. Aplicar patch-18 completo y redesplegar la edge function `user-management`.
3. Aplicar patch-19 omitiendo el hunk de `TesoreriaFlujoMonedas.tsx`; extraer el banner de `Cotizaciones.tsx` a un archivo hermano para respetar el límite de 200 líneas.
4. Correr TypeScript, ESLint (`--max-warnings 0`), las pruebas de los módulos tocados y `audit:all`.
5. Actualizar `CHANGELOG.md` y subir `APP_VERSION` a **13.642.0** con los IDs de hallazgos cubiertos (VB-12, VB-15, VB-16, VB-17, VB-19, VB-20, VB-22, VB-23, VB-24, VB-25, VB-29, VB-30, VB-36, VB-38, VB-42, VT-12 parcial, VT-13).
