# Cierre de auditoría 2026-08-09 — lo que falta corregir

Revisé los 44 hallazgos uno por uno contra el código actual (4 auditorías en paralelo).

## Estado verificado

| Nivel | Corregidos | Pendientes |
|---|---|---|
| Críticos (5) | C2, C3, C4, C5 | **C1 parcial** |
| Altos (13) | A1, A4, A5, A8, A9 | A2, A3, A6 (parcial), A7, A10, A11, A12, A13 |
| Medios (17) | M17 | M1–M16 (M6 parcial) |
| Bajos (9) | — | B1–B9 |

Total pendiente: **31 hallazgos** (1 crítico parcial, 8 altos, 16 medios, 9 bajos).

## Ola 4 — Seguridad y fuga de datos (primero)

- **C1 (resto):** `embarques_listado` y `facturas_listado` siguen tratando org NULL como "sin filtro". Exigir organización cuando el usuario es superadmin, enviar la org activa desde el frontend (`paginados.ts`, `facturasCrud.ts`) y bloquear la navegación a módulos operativos hasta elegir organización.
- **A13:** rol efectivo por organización. Nueva función `rol_efectivo(uid, org)` con precedencia organización → global, usada por las políticas de escritura y por `authorizeOrgRole` (sin caída permisiva al rol global).
- **A2:** una sola fuente de verdad de "organización activa": que la sesión exponga la organización efectiva (incluida la del selector de superadmin) y que `/usuarios`, auditoría, cotizaciones y facturas la consuman de ahí.
- **M1:** prohibir por base de datos roles globales (`super_admin`) en membresías de organización, y no promover ese rol desde el cliente.
- **M2:** política separada de borrado en tarifas, para que un agente externo no pueda borrar tarifas aprobadas.
- **M10, M11:** proteger la ruta antigua de detalle de proveedor y `/inicio` + `/operaciones`; la matriz de accesos pasa a "no listada = denegada".

## Ola 5 — Dinero: moneda, tipo de cambio y saldos

- **A6 (resto):** filtrar registros borrados en el guard de CxP (y restar notas de crédito aplicadas) y en el contador de movimientos por conciliar. **B9** es la misma instancia.
- **A7:** presupuesto vs real deja de contar gastos USD sin tipo de cambio como pesos 1:1; se excluyen y se marcan "sin TC".
- **A10:** quitar el tipo de cambio inventado (17.25/18.5) del tablero de dirección; avisar "TC no disponible" y reportar a Sentry.
- **M5, M6:** proyección/hueco de facturación y notas de crédito en dólares del estado de resultados usan el tipo de cambio real; sin TC confiable se excluye, no se asume 1.
- **M8:** el sugeridor de conciliación deja de cruzar monedas distintas.
- **M9:** el estado de cuenta al cliente incluye facturas parcialmente pagadas vencidas y reporta todas las monedas.
- **B3:** redondeo del pago en lote alineado con el del servidor.

## Ola 6 — Integridad transaccional y flujos rotos

- **A3:** reactivar cotización mediante RPC con transición permitida (hoy falla siempre).
- **M3, M4:** conversiones prospecto→cliente y lead→cliente/oportunidad como RPC transaccional con guardas de estado (hoy duplican registros).
- **M7:** actualización de recargos de tarifa en una sola transacción.
- **M15:** eliminar proforma vía RPC atómica que valide que no esté facturada.

## Ola 7 — Experiencia de uso y detalles

- **A11, B4:** fechas contables y periodos de comisiones en zona horaria de México; nombre de vendedora en comisiones devengadas.
- **A12:** los indicadores del menú lateral se actualizan (refresco periódico + invalidación en las mutaciones).
- **M12:** al cambiar rango de fechas se regresa a la página 1 en todos los listados.
- **M13:** al marcar un costo como pagado se refrescan todas las pantallas que lo muestran.
- **M14:** evitar doble descarga de PDF por doble clic.
- **B5:** parseo único de montos con separador de miles.
- **B6:** claves de almacenamiento del navegador centralizadas.
- **B7:** el formulario de envío ya no pisa lo que el usuario escribió.
- **B8:** eliminar el guard duplicado y contradictorio de notas de crédito.

## Ola 8 — Higiene de secretos y contraseñas

- **M16:** agregar `.env` y `.env.*` a `.gitignore` (la purga del historial de Git la debes hacer tú fuera de la plataforma; te doy los comandos).
- **B1:** sacar la llave pública del proyecto del smoke test y leerla de variables de entorno.
- **B2:** política de contraseñas de 10–12 caracteres con medidor de fuerza en alta, invitación y restablecimiento.

## Notas técnicas

- Cada ola termina con migraciones SQL (con `GRANT`/`REVOKE` según la norma H6), pruebas RLS en `supabase/tests/`, pruebas unitarias del código nuevo y suite completa en verde antes de pasar a la siguiente.
- Los componentes tocados se mantienen bajo 200 líneas y sin `any` (reglas Power of 10).
- Se registra cada ola en `CHANGELOG.md` con bump de `APP_VERSION`.
- Riesgo a vigilar: el cambio de rol efectivo (A13) y el filtro obligatorio de organización (C1) pueden endurecer accesos existentes; se agregan pruebas multi-tenant antes de aplicar.

## Orden sugerido

Olas 4 → 5 → 6 → 7 → 8. Puedo ejecutarlas en secuencia y reportar al cierre de cada una, o parar después de la 4 y 5 si prefieres validar primero lo de seguridad y dinero.
