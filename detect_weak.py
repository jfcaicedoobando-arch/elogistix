import re
import os

ASSERTION_REGEX = re.compile(r'\b(expect|expectTypeOf|assert|assertEquals|assertExists|assertRejects|assertThrows)\s*[(.]')

def analyze_file(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    findings = []
    current_test = None
    test_body = []
    
    for i, line in enumerate(lines):
        # Very simple heuristic to find test start
        m = re.search(r'\b(it|test)\s*\(\s*(["\'])(.*?)\2', line)
        if m:
            current_test = (i + 1, m.group(3))
            test_body = []
            continue
        
        if current_test:
            test_body.append(line)
            # Find end of block (approximate by searching for }); at start of line)
            # This is fragile but might work for standard formatting
            if re.match(r'^\s*\}\);', line):
                # Analyze body
                body_str = "".join(test_body)
                assertions = ASSERTION_REGEX.findall(body_str)
                
                # Weak 1: Only toBeDefined
                if len(assertions) == 1:
                    if 'toBeDefined()' in body_str:
                         findings.append((current_test[0], "WEAK", f"Test '{current_test[1]}' has only toBeDefined()"))
                
                # Weak 2: No render in component test
                if file_path.endswith('.tsx') and 'render(' not in body_str and 'renderHook(' not in body_str:
                     # This might be a pure logic test in a .tsx file, but worth noting
                     pass

                current_test = None
    
    return findings

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.test.ts') or file.endswith('.test.tsx'):
            p = os.path.join(root, file)
            res = analyze_file(p)
            for line, sev, msg in res:
                print(f"{p}:{line} [{sev}] {msg}")
