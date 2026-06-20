import os
import glob

def get_line_count(filepath):
    try:
        with open(filepath, 'r') as f:
            return len(f.readlines())
    except:
        return 0

def has_test_sibling(filepath):
    dir_name = os.path.dirname(filepath)
    base_name = os.path.basename(filepath)
    name_no_ext = os.path.splitext(base_name)[0]
    
    # Check for sibling .test.ts or .spec.ts
    for ext in ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx']:
        if os.path.exists(os.path.join(dir_name, name_no_ext + ext)):
            return True
        if os.path.exists(os.path.join(dir_name, "__tests__", name_no_ext + ext)):
            return True
    return False

def audit():
    # 1. Pure logic files
    logic_files = []
    patterns = [
        "src/features/*/domain/**/*.ts",
        "src/features/*/utils/**/*.ts",
        "src/lib/**/*.ts"
    ]
    for pattern in patterns:
        for filepath in glob.glob(pattern, recursive=True):
            if "__tests__" in filepath or ".test." in filepath or ".spec." in filepath:
                continue
            if not has_test_sibling(filepath):
                lc = get_line_count(filepath)
                if lc >= 20:
                    logic_files.append((filepath, lc))
    
    # 2. Services
    service_files = []
    for filepath in glob.glob("src/features/*/services/*.ts", recursive=True):
        if "__tests__" in filepath or ".test." in filepath or ".spec." in filepath:
            continue
        if not has_test_sibling(filepath):
            lc = get_line_count(filepath)
            if lc > 40:
                service_files.append((filepath, lc))

    # 3. Hooks
    hook_files = []
    hook_patterns = ["src/features/*/hooks/use*.ts", "src/hooks/**/use*.ts", "src/features/*/hooks/use*.tsx", "src/hooks/**/use*.tsx"]
    for pattern in hook_patterns:
        for filepath in glob.glob(pattern, recursive=True):
            if "__tests__" in filepath or ".test." in filepath or ".spec." in filepath:
                continue
            if not has_test_sibling(filepath):
                lc = get_line_count(filepath)
                hook_files.append((filepath, lc))
    hook_files.sort(key=lambda x: x[1], reverse=True)

    # 4. Routes
    route_files = []
    for filepath in glob.glob("src/features/*/routes/*.tsx", recursive=True):
        if "__tests__" in filepath or ".test." in filepath or ".spec." in filepath:
            continue
        if not has_test_sibling(filepath):
            lc = get_line_count(filepath)
            route_files.append((filepath, lc))
    route_files.sort(key=lambda x: x[1], reverse=True)

    print("--- LOGIC FILES ---")
    for f, lc in logic_files:
        print(f"{f} | {lc}")
    
    print("\n--- SERVICES ---")
    for f, lc in service_files:
        print(f"{f} | {lc}")

    print("\n--- HOOKS ---")
    for f, lc in hook_files[:20]:
        print(f"{f} | {lc}")

    print("\n--- ROUTES ---")
    for f, lc in route_files[:10]:
        print(f"{f} | {lc}")

audit()
