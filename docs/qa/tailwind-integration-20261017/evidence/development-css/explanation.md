# Development CSS audit

Ordered development CSS AST differs. No semantic equivalence claim is established. Preserve raw CSS and inspect firstOrderedAstDifferences before interpreting the HMR timing comparison.

PostCSS: 235917 raw bytes, SHA-256 a81eb7cbdadb3e882c4274d61ed919a30fcda14e3255e3df393bdd485a99616f.

Vite: 235821 raw bytes, SHA-256 c4f46f0d6650ed82a3b0224a6f97e9be57d3ee3d08277bd44ef1c88901b4c10e.

Candidate minus baseline: -96 bytes. Ordered AST equality: false.

Full CSS is saved as postcss.dev.css and vite.dev.css; ordered ASTs/inventories are retained per arm. differences.json records the first ordered structural differences, standalone comments, formatting raw fields, and first raw byte context. The same canonicalizer as the production CSS checker is imported without modification.

Installed Vite plugin generate:serve returns generate() output without its build-only optimize() stage. Installed PostCSS plugin defaults optimize to NODE_ENV===production, false here. Distinct serialization paths alone do not establish the cause or harmlessness of the observed byte difference; inspect the captured AST/raw evidence.
