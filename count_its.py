import re
import os

def count_its(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    describes = re.findall(r'describe\s*\(\s*["\'](.*?)["\']\s*,\s*\(\)\s*=>\s*\{(.*?)\}', content, re.DOTALL)
    results = []
    for title, body in describes:
        its = re.findall(r'\bit\s*\(', body)
        results.append((title, len(its)))
    return results

test_files = []
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.test.ts') or file.endswith('.test.tsx'):
            test_files.append(os.path.join(root, file))

overloaded = []
for f in test_files:
    res = count_its(f)
    for title, count in res:
        if count > 15:
            overloaded.append((f, title, count))

for f, t, c in sorted(overloaded, key=lambda x: x[2], reverse=True):
    print(f"{f}: describe '{t}' has {c} its")
