# Comparador Top 3: sólo rutas marítimas dadas de alta

## Problema
En Costeo → Buscar tarifa, los selectores de origen y destino muestran todo el catálogo de puertos. Así el usuario arma rutas que no existen en Costeo → Rutas y recibe "sin resultados", lo que confunde.

## Qué cambia para el usuario
- **Puerto de origen:** sólo lista puertos que son origen de alguna ruta activa de la organización.
- **Puerto de destino:** sólo lista los destinos que tienen ruta activa con el origen elegido (deshabilitado hasta elegir origen).
- Si cambian el origen y el destino ya no tiene ruta con él, el destino se limpia.
- Si la organización no tiene rutas activas: aviso «Aún no hay rutas marítimas dadas de alta. Créalas en Costeo → Rutas.» en lugar de los selectores vacíos.
- Las rutas activas sin tarifas vigentes siguen apareciendo; para ellas ya existe el mensaje de diagnóstico "sin tarifas".

## Detalles técnicos
- Reutilizar `useCosteoRutas()` (ya existe) y filtrar `activa !== false`.
- Nuevo helper puro `src/features/costeo/utils/puertosDeRutas.ts`: `origenesDeRutas(rutas, catalogo)` y `destinosDeOrigen(rutas, catalogo, origenId)`, cruzando ids con `usePuertos()` para obtener `PuertoOption`.
- `CosteoBuscar.tsx`: pasar las listas por la prop existente `puertos` de `PortIdSelect`; limpiar destino inválido en `elegirOrigen`. Mantener el archivo ≤200 líneas.
- Sin cambios de base de datos, RPC ni de `PortIdSelect`.
- Pruebas: test unitario del helper (origen sin rutas, ruta inactiva excluida, destinos por origen) y ajustar `CosteoBuscarTipo.test.tsx` si depende del catálogo completo. Sólo pruebas focalizadas de Costeo; CI completo queda en GitHub Actions.
