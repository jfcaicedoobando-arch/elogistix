# Cierre pre-release — Olas A, B y C

Plan basado en la guía subida, ajustado a lo que verifiqué hoy en el código y en la base de datos.

## Verificaciones previas

- **A.1 confirmado:** la RPC de traspasos bancarios no tiene ninguna clave anti-duplicado, y el diálogo que la llama tampoco envía una. Los pagos de clientes y proveedores sí la tienen. Es la única mutación de dinero sin protección contra doble clic.
- **B.2 ya no aplica:** revisé el pago de la factura F1034 en la base real. El monto aplicado (1,356.45) coincide exactamente con 23,141.03 pesos ÷ 17.06. El dato histórico ya está sano, así que se elimina del alcance (no se escribirá migración correctiva).
- **B.3 confirmado:** al sumar montos en moneda mixta, una moneda desconocida (por ejemplo libras) se trata como si fuera la moneda destino y se suma sin conversión.
- **B.5 confirmado:** el filtro por estatus de cobranza se aplica en memoria después de traer un tope de 2,000 facturas.

## Ola A — Bloqueante

### A.1 Traspasos bancarios a prueba de doble clic
Un traspaso entre cuentas hoy puede registrarse dos veces si el usuario da doble clic o si la red reintenta. Se añadirá el mismo candado que ya usan los pagos: cada intento lleva un "folio de intento" único y la base rechaza el segundo con el mismo folio. El usuario verá "Este traspaso ya fue registrado" y el diálogo cerrará como éxito, en lugar de crear un cargo y abono duplicados.

## Ola B — Lógica de negocio

### B.1 Comisiones en $0 nunca se pierden
Hoy, si el cálculo de una comisión falla, queda en cero con una nota de texto y nadie la recalcula. Se creará una cola de recálculo: cada fallo se registra con su motivo, aparece un contador "N comisiones pendientes de recálculo" en el módulo de comisiones y un botón de reintento que las reprocesa. Las comisiones ya liquidadas nunca se tocan.

### B.3 Sumas de moneda estrictas
Una moneda no soportada dejará de sumarse en silencio: la operación fallará con un mensaje claro en lugar de mezclar libras con dólares.

### B.4 Validación del XML fiscal en el servidor
Al adjuntar el XML de una factura de proveedor, el servidor volverá a leer el archivo y comparará UUID, RFC del emisor y total contra lo que declaró el navegador. Si no coinciden, se rechaza y se registra en la bitácora.

### B.5 Filtro de cobranza en base de datos
El filtro por estatus (vencida, por vencer, al día) se moverá a la consulta en base de datos, con el mismo criterio único que ya usan los KPIs, para que la bandeja siga funcionando con más de 2,000 facturas.

## Ola C — Cierre visual

### C.1 Tipografía de las piezas compartidas
Badges, tarjetas de KPI y celdas de dinero todavía usan tamaños crudos, así que un badge y la celda vecina se ven distintos. Se migran a los tokens semánticos y se extiende el candado automático para que no reaparezcan.

### C.2 Margen y tablas pendientes
- Adoptar el badge de margen en la tabla de Estado de Resultados.
- Migrar la tabla de flujo semanal de tesorería a la tabla estándar, corrigiendo el corte de la columna NETO.
- Cerrar con tope el listado de tablas crudas permitidas para que no siga creciendo.

### C.3 Reglas menores
- Documentar la regla de color de iconos (acento vs. acción) en la guía de diseño y en CONTRIBUTING.
- Completar el candado de fechas obsoletas con sincronización descendente.
- Endurecer dos expresiones de los candados visuales para que no se les escapen ternarios multilínea.
- Quitar el token literal del allowlist de detección de secretos.

## Detalles técnicos

- **A.1:** `ALTER TABLE` + índice UNIQUE parcial sobre `client_request_id` en la tabla que escribe `registrar_traspaso_bancario`; nueva firma con `p_client_request_id uuid DEFAULT NULL` al final y re-aplicación del bloque REVOKE/GRANT (patrón `fix_h6_21`). Cliente: UUID generado por intento de submit en `DialogTraspasoCuentas`, traducción de `23505` a aviso. Tests: uno de estabilidad del UUID y uno SQL en `supabase/tests/`.
- **B.1:** tabla `comisiones_recalculo_pendiente` con RLS por organización y GRANTs, inserción dentro de los dos `EXCEPTION WHEN OTHERS` de `calcular_comision_pago`, RPC `reprocesar_comisiones_pendientes(p_org)` con guarda `estado <> 'Liquidada'`.
- **B.3:** `sumarEnMoneda` (`src/lib/financial/costosUSD.ts`) lanza error de dominio si `!esMoneda(item.moneda)`; revisión de los consumidores del camino mixto.
- **B.4:** invocar `parse-cfdi-xml` desde el flujo de `adjuntar_xml_factura_entrante` y comparar con tolerancia 0.01.
- **B.5:** parámetro `p_estatus text[]` en la RPC de cobranza reutilizando el canon `lib/domain/vencimiento`; se conserva `assertNotTruncated`.
- **C.1/C.2:** ampliar `MODULOS_MIGRADOS` a `src/components/shared` y `src/components/ui`, y añadir tope de crecimiento en `no-raw-table.test.ts`.
- Cada ola cierra con bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Orden sugerido

1. Ola A (bloquea release).
2. Ola B: B.1, B.5, B.3, B.4.
3. Ola C completa.
