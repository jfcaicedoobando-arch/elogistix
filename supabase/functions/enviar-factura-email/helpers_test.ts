// Tests Deno para helpers de enviar-factura-email
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { sanitizeDownloadFilename, signUrl } from './helpers.ts';

type FakeAdmin = Parameters<typeof signUrl>[0];

Deno.test('sanitizeDownloadFilename reemplaza caracteres inválidos', () => {
  assertEquals(sanitizeDownloadFilename('A/1024'), 'A_1024');
  assertEquals(sanitizeDownloadFilename('F 2026-0001'), 'F_2026-0001');
  assertEquals(sanitizeDownloadFilename('A-1024'), 'A-1024');
  assertEquals(sanitizeDownloadFilename('///'), 'archivo');
});

function makeFakeAdmin(calls: Array<{ path: string; ttl: number; opts: unknown }>): FakeAdmin {
  return {
    storage: {
      from(_bucket: string) {
        return {
          createSignedUrl(path: string, ttl: number, opts?: unknown) {
            calls.push({ path, ttl, opts });
            return Promise.resolve({ data: { signedUrl: 'https://example.com/x' }, error: null });
          },
        };
      },
    },
  } as unknown as FakeAdmin;
}

Deno.test('signUrl pasa el parámetro download cuando se recibe filename', async () => {
  const calls: Array<{ path: string; ttl: number; opts: unknown }> = [];
  await signUrl(makeFakeAdmin(calls), 'org/fac/123.xml', 'Factura-A-1024.xml');
  assertEquals(calls.length, 1);
  assertEquals(calls[0].opts, { download: 'Factura-A-1024.xml' });
});

Deno.test('signUrl omite el parámetro download cuando no se pasa filename', async () => {
  const calls: Array<{ path: string; ttl: number; opts: unknown }> = [];
  await signUrl(makeFakeAdmin(calls), 'org/fac/123.pdf');
  assertEquals(calls[0].opts, undefined);
});
