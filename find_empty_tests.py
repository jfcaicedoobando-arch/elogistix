import os
import re

def analyze_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Encontrar todos los bloques it("...", () => { ... })
    # Esto es una simplificación, no maneja anidamiento complejo pero servirá para los simples
    matches = re.finditer(r'it\s*\(\s*["\'](.*?)["\']\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{', content)
    
    for match in matches:
        start = match.end()
        # Encontrar el cierre de la llave
        count = 1
        i = start
        while i < len(content) and count > 0:
            if content[i] == '{': count += 1
            elif content[i] == '}': count -= 1
            i += 1
        
        block = content[start:i-1]
        if 'expect(' not in block and 'expect.hasAssertions()' not in block:
            # Ignorar si es it.todo
            if not re.search(r'it\.todo', content[match.start():match.end()]):
                print(f"{filepath}:{content.count('\n', 0, match.start()) + 1} - it(\"{match.group(1)}\") has no expect")

test_files = []
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.test.ts') or file.endswith('.test.tsx'):
            test_files.append(os.path.join(root, file))

for f in test_files:
    analyze_file(f)
