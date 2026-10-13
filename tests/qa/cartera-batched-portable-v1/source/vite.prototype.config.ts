import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
function auditModules() {
  return { name: 'audit-bundle-modules', generateBundle(_options: unknown, bundle: any) {
    const chunk = Object.values(bundle).find((entry: any) => entry.type === 'chunk' && entry.isEntry) as any;
    this.emitFile({ type: 'asset', fileName: `audit/modules-${chunk?.name ?? 'bundle'}.json`, source: JSON.stringify([...this.getModuleIds()], null, 2) });
  }};
}
export default defineConfig({
 base: './', define: { 'process.env.NODE_ENV': JSON.stringify('production') },
 resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 plugins: [auditModules()], worker: { format: 'es', plugins: () => [auditModules()] },
 build: { outDir: 'dist-prototype', assetsInlineLimit: 0, minify: false, lib: { entry: 'coordinator-web.ts', formats: ['es'], fileName: 'coordinator-web' } }
});
