# Paginación y cancelación de Proyección y Cartera

Proyección y Cierre mensual comparten los servicios de Proyección. Sus tablas
se recorren por ID ascendente; `factura_embarques` usa la clave compuesta
`factura_id, embarque_id`. CxP recorre cabeceras por ID. Al terminar, se conserva
la presentación por ETA o vencimiento, con desempate por ID y nulos al final.

Las claves deben ser no nulas, únicas, inmutables y comparables como UUID
canónicos. El helper rechaza una página repetida o que no avanza. Una alta o
baja anterior al cursor no desplaza las páginas pendientes: no repite ni salta
filas que siguen vigentes y cumplen los filtros durante toda la lectura.

Esto no ofrece un snapshot transaccional. Una alta con clave anterior al
cursor puede quedar para la siguiente carga; una alta posterior puede entrar.
Una fila ya leída puede borrarse o cambiar después. Si cambian las columnas
filtradas, el conjunto también puede cambiar. Cabeceras, conceptos, facturas
y saldos se leen en peticiones diferentes y pueden corresponder a instantes
distintos. Una exportación de un corte consistente requiere soporte servidor.

Los lotes piden 1.000 filas y requieren que el límite de PostgREST admita ese
tamaño. `supabase/config.toml` declara 10.000; no certifica la configuración de
Live. Proyección conserva su cap duro de 50.000; CxP conserva la lectura sin
ese cap. La fuente CxC de Cartera mantiene el límite existente de 2.000 y el
rechazo visible al alcanzarlo.

Los hooks pasan `AbortSignal` a servicios, páginas, lotes de saldos y RPC de
lectura mediante `abortSignal` del SDK. Se comprueba la señal antes de lanzar
la siguiente página o lote y al volver del I/O. La verificación de organización
de Cartera conserva su API: su lectura iniciada puede terminar, pero una señal
cancelada impide continuar con las fuentes de datos. Abortar HTTP en el cliente
no acredita la cancelación de trabajo SQL ya iniciado en el servidor.

Las regresiones verifican páginas inválidas, errores posteriores, cap duro,
serialización del cursor compuesto y cancelación con el SDK y un fetch sintético.
El harness local adicional comprueba altas/bajas con 1.001/5.001 filas y CSV.
No se usan datos del ERP ni servicios fiscales. Fuentes Windows y PDF de 5.001
filas son pendientes separados y no forman parte de esta corrección.
