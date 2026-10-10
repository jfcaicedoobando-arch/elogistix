import { readFileSync } from 'node:fs';

// El UUID nulo debe llegar al RPC y fallar antes de cualquier escritura.
// No confundir autenticación, schema cache, rate limiting o proxy con éxito.
try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  if (process.argv[2] !== '404' || payload?.code !== 'P0002'
      || payload?.message !== 'Cotización no encontrada') {
    throw new Error('Respuesta distinta al contrato 404/P0002: Cotización no encontrada');
  }
  console.log('duplicar_cotizacion: contrato de UUID inexistente verificado');
} catch (error) {
  console.error(`::error::Smoke duplicar_cotizacion falló: ${error.message}`);
  process.exitCode = 1;
}
