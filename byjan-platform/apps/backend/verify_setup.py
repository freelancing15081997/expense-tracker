#!/usr/bin/env python
"""Verify backend setup"""

import sys
sys.path.insert(0, '.')

try:
    from app.main import app
    print("[OK] App imported successfully")
    print(f"[OK] Total routes: {len(app.routes)}")
    print()
    print("Routes:")
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = route.methods if hasattr(route, 'methods') else 'GET'
            print(f"  {methods} {route.path}")
except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
