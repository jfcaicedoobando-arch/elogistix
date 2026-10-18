import assert from 'node:assert/strict';

// Experimental override only. Neither root Vite nor PostCSS config is edited.
// The existing root/fixture PostCSS configurations contain only Tailwind.
export async function integrationOverrides(variant) {
  assert.ok(['postcss', 'vite'].includes(variant), 'Unknown Tailwind integration');
  if (variant === 'postcss') return {};
  const { default: tailwindcss } = await import('@tailwindcss/vite');
  return {
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [] } },
  };
}

export function isolatedEnvironment(mode = 'production') {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR',
    'SYSTEMDRIVE', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432', 'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER', 'PROCESSOR_LEVEL', 'PROCESSOR_REVISION',
    'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'PLAYWRIGHT_BROWSERS_PATH']);
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase())));
  return { ...environment, NODE_ENV: mode, NODE_OPTIONS: '--max-old-space-size=8192', ANALYZE: 'false',
    CI_REPORT_COMPRESSED_SIZE: 'false', VITE_SUPABASE_URL: 'http://127.0.0.1:9',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'benchmark-public-placeholder' };
}
