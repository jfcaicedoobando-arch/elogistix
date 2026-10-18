import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformCandidate, instrumentAttribution } from './candidate.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const local = path.join(root, 'e2e/manual-invoice');
export default defineConfig(({ mode }) => {
  const candidate = mode.includes('candidate');
  const attribution = mode.includes('profile');
  const boundaries = [
    '@/hooks/shared/useOrgActiva', '@/features/catalogos/hooks/useTasaIVA',
    '@/features/facturacion/hooks/useClientesFiscalOpts', '@/features/configuracion',
    '@/features/facturacion/hooks/useBanxicoTipoCambio', './useFacturaManualSubmit',
    './CreditoExcesoConfirmDialog',
  ];
  return {
    root: local, base: './', envDir: false, publicDir: false,
    define: { __ATTRIBUTION__: JSON.stringify(attribution) },
    plugins: [{ name: 'isolated-manual-invoice', enforce: 'pre',
      transform(code, rawId) {
        const id = rawId.replaceAll('\\', '/');
        if (id.endsWith('/hooks/useFacturaManualForm.ts')) {
          code = `import { fixtureConcepts } from ${JSON.stringify(path.join(local, 'fixture.ts'))};\n` + code;
          code = code.replace('useState<ConceptoManualInput[]>(INITIAL_CONCEPTOS)', 'useState<ConceptoManualInput[]>(fixtureConcepts)');
          code = code.replace('useState<string>("")', 'useState<string>("synthetic-client")');
        }
        if (candidate) code = transformCandidate(code, id);
        if (attribution) code = instrumentAttribution(code, id);
        return code;
      },
      generateBundle() {
        const modules = [...this.getModuleIds()].map(x => x.replaceAll('\\', '/'));
        const forbidden = modules.filter(x => /\/src\/(App\.|main\.|integrations\/|lib\/(sentry|auth\/|contexts\/auth)|features\/(auth\/|.*\/services\/))|\/@sentry\//i.test(x));
        if (forbidden.length) throw new Error(`Forbidden runtime graph: ${forbidden.join(', ')}`);
        this.emitFile({ type: 'asset', fileName: 'module-audit.json', source: JSON.stringify({
          mode, modules: modules.filter(x => x.includes('/src/')), forbidden,
        }, null, 2) });
      },
    }, react()],
    resolve: { alias: [
      ...boundaries.map(find => ({ find, replacement: path.join(local, 'stubs.ts') })),
      ...(attribution ? [{ find: /^react-dom\/client$/, replacement: 'react-dom/profiling' }] : []),
      { find: '@', replacement: path.join(root, 'src') },
    ] },
    css: { postcss: path.join(root, 'e2e/visual') },
    build: { outDir: path.join(root, 'dist/manual-invoice', mode), emptyOutDir: true,
      minify: true, sourcemap: false },
  };
});
