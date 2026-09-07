# Quitar el aviso falso "Debes iniciar sesión para procesar la factura PDF"

## Qué está pasando

El aviso no significa que tu sesión terminó. En la última entrega (13.823.192) el sistema decidió pedir una credencial nueva al servidor **antes** de subir cada PDF. Si esa renovación no se logra en ese instante —porque otra pestaña acaba de renovarla, porque el servidor de sesiones responde lento o limita los reintentos— el código concluye "no hay sesión" y corta el envío, aunque tu sesión siga perfectamente válida.

Confirmado leyendo el código: en `parsePdfInvoice.ts` el envío llama a la renovación forzada en el primer intento y, si devuelve vacío, lanza el mensaje. En `ensureFreshSession.ts` el modo forzado devuelve vacío cuando la renovación falla y la credencial en memoria no cambió, sin distinguir "sesión revocada" de "renovación no disponible ahora mismo".

## Corrección mínima

1. Primer envío: usar la credencial vigente que ya tiene la aplicación, sin exigir una renovación nueva. Sólo si no hay ninguna sesión se pide iniciar sesión.
2. Reintento: si el servidor rechaza la credencial (401), entonces sí renovar de forma forzada y volver a enviar una vez. Así se conserva la corrección de 189/190/192 contra credenciales caducadas, sin castigar a quien sí tiene sesión.
3. Si la renovación forzada del reintento no es posible, el mensaje debe describir la situación real ("no se pudo validar tu sesión, vuelve a intentarlo") en lugar de afirmar que hay que iniciar sesión.
4. Ajustar la regresión focalizada existente: primer intento con credencial vigente sin renovación forzada, reintento con renovación tras 401, y no cortar el envío cuando la renovación falla pero hay sesión válida.

## Alcance

Sólo el cliente de captura de factura PDF y el mensaje. Sin tocar Edge Functions, SQL, base de datos, permisos, RLS ni el flujo de aprobación de Compras. Entrega patch con changelog y manifiesto por el generador. Pruebas, CI y RLS quedan para GitHub Actions.

## Archivos previstos

- `src/features/cxp/services/parsePdfInvoice.ts`
- `src/constants/authMessages.ts` (mensaje honesto de reintento)
- `src/features/cxp/services/__tests__/parsePdfInvoice.test.ts`
- `CHANGELOG.md`, `src/constants/appVersion.ts`, `supabase/releases/migration-manifest.json`
