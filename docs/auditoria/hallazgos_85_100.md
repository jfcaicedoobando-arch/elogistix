# Correcciones de auditoría financiera 85–100

Versión preparada: 13.824.26. Base revisada: `5775b5e7df7a069594b17faeb59c5650dc9622b7` (13.824.24). Integrado sobre main `ba6311ec2c039fa3dfdaee9e1fc9ca9ee3434a40` (13.824.25), conservando íntegros los cambios editoriales de PR131. Cambios desarrollados y validados en entorno cloud aislado. La auditoría se detuvo en 100; este paquete no agrega hallazgos ni modifica sus fixtures.

## Matriz de aceptación

| Hallazgo | Corrección y evidencia automatizada |
| --- | --- |
| 85 | Presupuesto usa el TC documental EUR: EUR100×20=MXN2000, sin aviso falso; USD/MXN y ausencia de TC conservados. `vsRealDomain.gastoEur.test.ts`. |
| 86 | Estado bancario anterior al arranque devuelve cifras nulas con cobertura explícita, nunca apertura futura ni cero inventado. Cruces de corte, exportaciones y aislamiento probados en `audit86_estado_cuenta_cobertura.sql` y pruebas de cobertura de UI/servicio. |
| 87 | El porcentaje usa una base estable por selección; repetir10 y cambiar10→20 conserva11.60/23.20. Editar descripción no redefine precio; un precio editado sí define base explícita. `useNotaCreditoDraft.reset.test.tsx`. |
| 88 | Forma99 bloqueada antes del registro PPD en formulario, servicios y autoridad SQL; controles de forma03 y lote. `registrarPagoDerivados.test.ts`, pruebas de servicios y SQL88/91/93. |
| 89 | PDF y GUI comparten las filas nominales por moneda, incluyendo EUR100 y neto−100. Prueba del renderer real `tests/pdf/documents.test.tsx`, texto y revisión visual del PDF. |
| 90 | Ambos KPI usan periodo y fuente del snapshot. El detalle rehidrata septiembre y la fuente explícita desde URL; navegación atrás/adelante mantiene el enlace. `BandaKPIs.periodo.test.tsx`, `useProfit.test.tsx`, `usePeriodoMesUrl.test.tsx`. |
| 91 | USD/USD aplica nominal1 pero guarda valuación MXN independiente; misma regla EUR/EUR. DOF/captura manual y controles MXN, lote, SQL y REP. No se revalúa historia. |
| 92 | El REP deriva equivalencia de dinero recibido/aplicado y verifica su reconstrucción a centavos: MXN20/USD1→0.05, independiente del TC documental18.1903. CAS y congelamiento de la fila durante claim, incluidos fecha, referencia, orden y borrado. `audit91_92_valoracion_test.ts` y SQL88/91/93. |
| 93 | SQL calcula realizado:20−1×18.1903=1.8097; pruebas positiva, negativa y cero exacto, RPC individual/lote/directo, sin aceptar cifra arbitraria del cliente. |
| 94 | Folio canónico sin duplicar serie, compatible con números ya prefijados y enlaces originales. `audit94_98_99_tesoreria.sql` y pruebas de detalle. |
| 95 | Quitar XML invalida archivo, UUID y adjuntos derivados; la respuesta tardía no repuebla el formulario. Volver a elegir el mismo archivo y Limpiar cubiertos. `useCargaCfdi.test.tsx`, `DialogNotaCreditoProveedor.identidad.test.tsx`. |
| 96 | Parser existente autenticado exige factura objetivo de la organización y compara tipoE, UUID, emisor, receptor, relación y duplicado antes del prefill. Cliente exige confirmación de esa factura y mantiene captura manual. `validarNcProveedor_test.ts` y diálogo de identidad. El XML original de auditoría fue rechazado localmente por emisor; no se registró. |
| 97 | Total capturado3000 con cantidad960 conserva venta3000/utilidad456; unitario persistido3.125, relectura estable y Cancelar recupera2928. `costosPL.test.ts`, `SeccionCostosInternosPLDetalle.sello.test.tsx`; preserva CAS y metadatos. |
| 98 | Saldo actual incluye NC aplicadas convertidas a moneda factura; USD1−0.50−0.50=0, sin mezclar nominales. SQL94/98/99 y pruebas de dominio, servicio y UI. |
| 99 | Efectivo/01 sin cuenta es No aplica; no pertenece a pendientes. Con cuenta conserva conciliación y PDF/CSV usan el mismo criterio. SQL94/98/99 y pruebas de dominio/UI. |
| 100 | La devolución es entrada independiente con fecha/cuenta del asiento real y neto propio; mantiene egreso bruto. Devuelto0.03 compensa salida0.03 sin borrarla. SQL100 y pruebas de ledger, filtros, detalle, exportación/PDF. |

## Contratos y alcance

- Dos migraciones nuevas: `20261005060100_audit88_91_93_cobros_valuacion.sql` y `20261005060200_audit86_94_98_99_100_tesoreria.sql`. No hay DML de backfill ni renumeración.
- Definiciones canónicas, baseline y manifest se mantienen alineados con replay real. Las funciones existentes preservan firmas, grants, RLS y alcance de organización; los nuevos campos del JSON de lectura son aditivos.
- Se conservan las guardas de timbrado y cancelación, los permisos y las configuraciones JWT/webhook existentes. No hay nuevas dependencias de producción ni credenciales.
- El parser de NC valida identidad documental, no sustituye una consulta de vigencia SAT ni certifica autenticidad del XML. Las NC manuales siguen siendo un flujo explícito separado, sin reutilizar UUID/adjuntos retirados.
- Los comprobantes y cobros anteriores permanecen tal como se capturaron. Corregir el código no cancela, reemite ni compensa P4/P5 ni cambia otras operaciones históricas.
- Para detalle fiscal, fuentes primarias y límites de precisión, ver [Cobros y REP88/91–93](./cobros_rep_88_91_93.md). Las pruebas con XML Sandbox o mocks no garantizan aceptación fiscal en producción.

## Validación local

- Replay completo de migraciones, guardas service-role/RLS/integridad y baseline generado con PostgreSQL17: 45 suitesRLS y181 pruebas SQL de comportamiento aprobadas, incluidas todas las nuevas.
- TypeScript completo aprobado con heap de3GiB; los intentos anteriores con heap por defecto/8GiB fallaron por recursos, no se cuentan como pases.
- Build Vite aprobado con sourcemaps deshabilitados y configuración local ficticia; no es un artefacto desplegado.
- Renderer PDF real:9 pruebas aprobadas; reporte de Tesorería EUR revisado visualmente.
- Deno completo:887 pruebas aprobadas, con verificación de tipos y detección de fugas, caché de dependencias y permiso exclusivo para escuchar localmente (sin salida de red). Las887 incluyen113 de REP y30 de parser/identidad. Los primeros5 fallos con variables Supabase ficticias se reprodujeron igual en main y desaparecieron al retirarlas; interferían con los mocks inyectados.
- Vitest y lint globales: resultados finales en el resumen de entrega, sin confundir pruebas enfocadas con suite completa.
- Guardas de migraciones, espejos, manifest, columnas de esquema, higiene de tests, Sonner, imports arquitectónicos y revisión de casts aprobadas. `audit:soft-delete` falla con8 lecturas y1entrada obsoleta, reproducidos idénticamente en main5775b5e. `audit:rpc-columns` señala5 referencias fuera de allow-list en3funciones cuyo cuerpo es idéntico a main; ninguna pertenece al patch. `knip --no-progress` reproduce exactamente su reporte de main (1 archivo,3dependencias de desarrollo,25exports y16tipos exportados sin uso). No se modifica la deuda ni se amplían allow-lists para ocultarla.
- Un primer intento de Vitest completo fue bloqueado por un intento inesperado de conexión Supabase. La ejecución segura reemplaza el destino por localhost/datos ficticios y bloquea TCP/TLS/DNS/fetch antes de abrir conexiones. Se aisló la lectura de catálogo no mockeada de `CotizacionDetalleAcciones.test.tsx`; las validaciones no autorizan tráfico a servicios reales.
- GUI de navegador no ejecutada: el navegador cloud rechazó el servidor local con `ERR_BLOCKED_BY_CLIENT`. El harness compiló, pero no se afirma validación visual interactiva ni se evade esa restricción. Los tests DOM y la inspección PDF se reportan aparte.

## Plan de publicación atómica, pendiente de autorización

1. Congelar commit y revisar CI para ese commit; confirmar el inventario de migraciones y respaldo operativo según procedimiento del entorno. No activar mantenimiento antes de acordar ventana.
2. En la ventana autorizada, impedir capturas financieras con clientes antiguos durante el cambio de contrato. Aplicar las dos migraciones forward con el runner transaccional habitual y verificar funciones, triggers, grants y RLS.
3. Desplegar `facturapi-emitir-rep` y `parse-cfdi-xml` del mismo commit, preservando configuración JWT y secretos existentes. Verificar estado y hashes; no modificar webhooks como parte de este cambio.
4. Publicar frontend13.824.26 y exigir refresco de sesiones antiguas antes de reabrir captura. El nuevo frontend falla cerrado si el parser anterior no devuelve validación de identidad; el nuevo trigger rechaza TC extranjero neutral de clientes viejos.
5. Repetir aceptación con fixtures nuevas autorizadas en Sandbox, comparar recibido/aplicado/valuación/diferencia/XML y revisar navegación/exportaciones. Mantener envío de correo desactivado. No reutilizar ni alterar las fixtures de la auditoría para obtener un resultado verde.
6. Si un gate falla, mantener bloqueadas las operaciones afectadas y coordinar una corrección forward; no borrar historial ni revertir constraints de dinero mientras existan operaciones nuevas.

Este documento prepara la publicación; no autoriza merge, despliegue, timbrado, cancelación, correos ni cambios remotos.
