# Revisión de los 12 grupos de costos "repetidos"

## Conclusión de la revisión (ya verificada contra la base de datos)

**No son duplicados.** Cada grupo tiene exactamente tantas copias como contenedores tiene el embarque, y la suma de todas las copias cuadra con el subtotal de la factura de proveedor real. Son costos **prorrateados por contenedor** que quedaron guardados sin su contenedor asignado (`contenedor_id` vacío), y por eso mi consulta de duplicados los agrupó como si fueran repeticiones.

| Expediente | Contenedores | Copias por concepto | Factura(s) | Cuadre |
|---|---|---|---|---|
| ELIMP00149 | 6 | 6 | FP-000023 / FP-000029 | 6 × 2,627.17 = 15,763 = subtotal exacto |
| ELIMP00189 | 9 | 9 | FP-000026 / FP-000027 | 20,912.63 vs 20,902 (dif. 10.63) |
| ELIMP00193 | 3 | 3 | FP-000025 | 7,023.99 = 7,024 |
| ELIMP00195 | 8 | 8 | FP-000060 | flete 22,589 = subtotal exacto |
| ELIMP00219 | 5 | 5 | FP-000069 / FP-000081 | flete 15,900 = subtotal exacto |
| ELIMP00272 | 6 | 6 | FP-000087 / FP-000088 | 31,962.96 = 31,963 |

Es decir: **no hay costo inflado y no hay nada que borrar en estos 6 expedientes.** Fue correcto dejarlos intactos en la limpieza anterior.

## Dos hallazgos reales que sí conviene corregir

1. **FP-000060 (ELIMP00195) — factura sobre-vinculada.** El flete (8 × 2,823.625 = 22,589) cuadra exacto con el subtotal de la factura, pero además tiene ligados los "Cargos en Destino" (8 × 86.375 = 691) que pertenecen a otra factura. La factura queda con 23,280 ligados contra 22,589 de subtotal: 691 USD de sobre-vinculación.
2. **FP-000081 (ELIMP00219) — ajuste replicado 5 veces.** El concepto "Ajuste factura CON-B-12579" de −12 USD existe 5 veces (−60 en total) mientras los cargos ligados suman 435 = subtotal. El ajuste debería aparecer una sola vez (−12) o no estar ligado a esta factura.

## Trabajo propuesto

### 1. Corregir los dos hallazgos reales
- Desvincular de FP-000060 los 8 conceptos "Cargos en Destino" que no le corresponden (dejando el flete que sí cuadra), para que el cuadre de la factura vuelva a 22,589.
- Dejar un solo renglón del "Ajuste factura CON-B-12579" en ELIMP00219 (borrado lógico de los otros 4) y revisar su vínculo con FP-000081.
- Ambas correcciones con registro en bitácora y sin tocar pagos ya aplicados.

### 2. Recuperar el contenedor en los costos prorrateados (opcional, recomendado)
Asignar el `contenedor_id` que le corresponde a cada copia en los 6 expedientes, repartiendo una copia por contenedor. Beneficio: el desglose de costo por contenedor vuelve a ser correcto y estos costos dejan de verse como "duplicados" en cualquier auditoría futura.

### 3. Detección continua, no manual
Agregar una regla nueva a la Auditoría operativa: **"Costos repetidos sospechosos"** — marca los grupos de conceptos idénticos dentro de un embarque cuando el número de copias **no** coincide con el número de contenedores y **no** están respaldados por una factura de proveedor. Así el próximo caso aparece solo, sin revisión a mano.

## Detalles técnicos

- Verificación hecha con consultas de lectura sobre `conceptos_costo`, `proveedor_facturas_conceptos`, `proveedor_facturas` y `embarque_contenedores`; los 12 grupos tienen `contenedor_id IS NULL` y `copias = contenedores`.
- Correcciones de datos vía la herramienta de datos (borrado lógico `deleted_at` y `DELETE` de renglones de `proveedor_facturas_conceptos`), no migración de esquema.
- La regla nueva se añade dentro de `public.auditoria_embarques_org` (nuevo CTE + entrada en `por_regla`), más su tipo `ReglaAuditoria`, etiqueta y descripción en `src/features/auditoria`.
- Tests: caso de dominio para la clasificación de la nueva regla y prueba de etiquetas.
- Se registra el cambio en `CHANGELOG.md` con bump de `APP_VERSION`.
