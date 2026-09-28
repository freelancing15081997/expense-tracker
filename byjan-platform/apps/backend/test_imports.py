#!/usr/bin/env python
"""Test that all modules can be imported"""

import sys
sys.path.insert(0, '.')

def test_import(module_name, description):
    """Test importing a module"""
    try:
        __import__(module_name)
        print(f"[OK] {description}: {module_name}")
        return True
    except Exception as e:
        print(f"[FAIL] {description}: {module_name}")
        print(f"       Error: {e}")
        return False


def main():
    """Run import tests"""
    tests = [
        ("app.main", "Main application"),
        ("app.settings", "Settings"),
        ("app.router", "API router"),
        ("app.shared.database", "Database"),
        ("app.shared.ids", "ID generation"),
        ("app.shared.types", "Shared types"),
        ("app.shared.logging", "Logging"),
        ("app.platform.domain.models", "Platform models"),
        ("app.platform.infra.orm", "Platform ORM"),
        ("app.platform.service", "Platform service"),
        ("app.platform.api", "Platform API"),
        ("app.business.domain.models", "Business models"),
        ("app.business.domain.rules", "Business rules"),
        ("app.business.infra.orm", "Business ORM"),
        ("app.business.service", "Business service"),
        ("app.business.api", "Business API"),
        ("app.ca.domain.models", "CA models"),
        ("app.ca.infra.orm", "CA ORM"),
        ("app.ca.api", "CA API"),
        ("app.console.service", "Console service"),
        ("app.console.api", "Console API"),
        ("app.deps", "Dependencies"),
        ("app.worker", "Worker"),
    ]

    print("Testing module imports...")
    print()

    results = []
    for module_name, description in tests:
        result = test_import(module_name, description)
        results.append(result)

    print()
    print(f"Results: {sum(results)}/{len(results)} passed")

    if all(results):
        print("[OK] All modules imported successfully!")
        return 0
    else:
        print("[FAIL] Some modules failed to import")
        return 1


if __name__ == "__main__":
    sys.exit(main())
