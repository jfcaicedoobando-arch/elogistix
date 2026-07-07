// Tests Deno para helpers de enviar-factura-email
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { sanitizeDownloadFilename, signUrl } from './helpers.ts';

Deno.test('sanitizeDownloadFilename reemplaza caracteres inválidos', () => {
  assertEquals(sanitizeDownloadFilename('A/1024'), 'A_1024');
  assertEquals(sanitizeDownloadFilename('F 2026-0001'), 'F_2026-0001');
  assertEquals(sanitizeDownloadFilename('A-1024'), 'A-1024');
  assertEquals(sanitizeDownloadFilename('///'), 'archivo');
});

Deno.test('signUrl pasa el parámetro download cuando se recibe filename', async () => {
  const calls: Array<{ path: string; ttl: number; opts: unknown }> = [];
  const fakeAdmin = {
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl(path: string, ttl: number, opts?: unknown) {
            calls.push({ path, ttl, opts });
            return Promise.resolve({ data: { signedUrl: 'https://example.com/x?download=y' }, error: null });
          },
        };
      },
    },
  };
  // deno-lint-ignore no-explicit-any
  const url = await signUrl(fakeAdmin as any, 'org/fac/123.xml', 'Factura-A-1024.xml');
  assertEquals(url, 'https://example.com/x?download=y');
  assertEquals(calls.length, 1);
  assertEquals(calls[0].opts, { download: 'Factura-A-1024.xml' });
});

Deno.test('signUrl omite el parámetro download cuando no se pasa filename', async () => {
  const calls: Array<{ opts: unknown }> = [];
  const fakeAdmin = {
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl(_path: string, _ttl: number, opts?: unknown) {
            calls.push({ opts });
            return Promise.resolve({ data: { signedUrl: 'https://example.com/x' }, error: null });
          },
        };
      },
    },
  };
  // deno-lint-ignore no-explicit-any
  await signUrl(fakeAdmin as any, 'org/fac/123.pdf');
  assertEquals(calls[0].opts, undefined);
});
