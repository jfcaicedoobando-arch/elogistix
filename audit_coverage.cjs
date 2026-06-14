const fs = require('fs');
const path = require('path');

const targetDirs = [
  'src/features',
  'src/services',
  'src/hooks',
  'src/lib',
  'src/contexts/auth',
  'src/generators',
  'src/pdf/documents'
];

const results = [];
let totalProductive = 0;
let withTest = 0;

function isTestFile(filename) {
  return filename.endsWith('.test.ts') || filename.endsWith('.test.tsx') || filename.includes('/__tests__/');
}

function getTestPath(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  
  const possiblePaths = [
    path.join(dir, '__tests__', `${base}.test${ext}`),
    path.join(dir, '__tests__', `${base}.test.ts`),
    path.join(dir, '__tests__', `${base}.test.tsx`),
    path.join(dir, `${base}.test${ext}`),
    path.join(dir, `${base}.test.ts`),
    path.join(dir, `${base}.test.tsx`),
  ];
  
  return possiblePaths.find(p => fs.existsSync(p));
}

function auditDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === '.git') continue;
      auditDir(fullPath);
    } else if (entry.isFile()) {
      if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx')) continue;
      if (isTestFile(fullPath)) continue;
      if (entry.name === 'index.ts' || entry.name.endsWith('.types.ts') || entry.name.endsWith('.schema.ts') || entry.name.endsWith('.d.ts')) continue;
      
      // Filter productive modules
      const isProductive = 
        fullPath.includes('/services/') || 
        fullPath.includes('/hooks/') || 
        fullPath.includes('/domain/') || 
        fullPath.includes('src/lib/') ||
        fullPath.includes('src/services/') ||
        fullPath.includes('src/hooks/') ||
        fullPath.includes('src/contexts/auth/') ||
        fullPath.includes('src/generators/') ||
        fullPath.includes('src/pdf/documents/');
      
      if (!isProductive) continue;

      totalProductive++;
      const testPath = getTestPath(fullPath);
      if (testPath) {
        withTest++;
      } else {
        results.push(fullPath);
      }
    }
  }
}

targetDirs.forEach(auditDir);

console.log(JSON.stringify({
  totalProductive,
  withTest,
  withoutTest: results
}, null, 2));
