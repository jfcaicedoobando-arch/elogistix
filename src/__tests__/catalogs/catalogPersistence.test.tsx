import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/query/queryErrorReporting', () => ({
  reportQueryError:vi.fn(),notifyQueryFailure:vi.fn(),rootOf:vi.fn(),opOf:vi.fn(),
}));
import { queryClient, shouldDehydrateCatalogQuery } from '@/lib/query/queryClient';
afterEach(() => queryClient.clear());
describe('Local audit: production persistence allowlist', () => {
  it.each(['planes','puertos','navieras','tipos_contenedor','tipos_cambio_dof','tasa_iva'])(
    '%s is excluded from the persistent query cache', root => {
      expect(shouldDehydrateCatalogQuery([root],'success')).toBe(false);
    },
  );
  it.each(['exchange-rates'])(
    '%s is only persisted after success', root => {
      expect(shouldDehydrateCatalogQuery([root],'success')).toBe(true);
      expect(shouldDehydrateCatalogQuery([root],'error')).toBe(false);
      expect(shouldDehydrateCatalogQuery([root],'pending')).toBe(false);
    },
  );
});
