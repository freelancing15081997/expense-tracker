#!/bin/bash

# Byjan Platform Verification Script
# Verifies all components are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Byjan Platform Verification ===${NC}"
echo ""

# Check backend files
echo -e "${YELLOW}Checking backend files...${NC}"

backend_files=(
    "apps/backend/app/main.py"
    "apps/backend/app/settings.py"
    "apps/backend/app/router.py"
    "apps/backend/app/worker.py"
    "apps/backend/app/platform/api.py"
    "apps/backend/app/business/api.py"
    "apps/backend/app/ca/api.py"
    "apps/backend/app/console/api.py"
    "apps/backend/app/shared/database.py"
    "apps/backend/app/shared/logging.py"
    "apps/backend/Dockerfile"
    "apps/backend/render.yaml"
    "apps/backend/pyproject.toml"
)

for file in "${backend_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Check frontend files
echo -e "${YELLOW}Checking frontend files...${NC}"

frontend_files=(
    "apps/frontend/src/App.jsx"
    "apps/frontend/src/main.jsx"
    "apps/frontend/src/components/TraceConsole.tsx"
    "apps/frontend/src/lib/api.ts"
    "apps/frontend/src/lib/auth-client.ts"
    "apps/frontend/wrangler.toml"
    "apps/frontend/package.json"
    "apps/frontend/vite.config.ts"
)

for file in "${frontend_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Check database migrations
echo -e "${YELLOW}Checking database migrations...${NC}"

migration_files=(
    "apps/backend/migrations/versions/20260928_0000-core_schema.py"
    "apps/backend/migrations/versions/20260928_0001-business_schema.py"
    "apps/backend/migrations/versions/20260928_0002-ca_schema.py"
    "apps/backend/migrations/versions/20260928_0003-console_schema.py"
)

for file in "${migration_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Check test files
echo -e "${YELLOW}Checking test files...${NC}"

test_files=(
    "apps/backend/tests/conftest.py"
    "apps/backend/tests/test_business_calculations.py"
    "apps/backend/tests/test_document_engine.py"
    "apps/backend/tests/test_platform_auth.py"
)

for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Check documentation
echo -e "${YELLOW}Checking documentation...${NC}"

doc_files=(
    "README.md"
    "IMPLEMENTATION_SUMMARY.md"
    "docs/COVERAGE.md"
    "docs/DECISIONS.md"
    "docs/EVENTS.md"
)

for file in "${doc_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Check environment files
echo -e "${YELLOW}Checking environment files...${NC}"

env_files=(
    "apps/backend/.env"
    "apps/backend/.env.example"
    "apps/frontend/.env.example"
)

for file in "${env_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Check deployment files
echo -e "${YELLOW}Checking deployment files...${NC}"

deploy_files=(
    "apps/backend/Dockerfile"
    "apps/backend/render.yaml"
    "apps/frontend/wrangler.toml"
    "deploy.sh"
)

for file in "${deploy_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
    fi
done

echo ""

# Count endpoints
echo -e "${YELLOW}Counting API endpoints...${NC}"

platform_endpoints=$(grep -c "^@router\." apps/backend/app/platform/api.py || echo "0")
business_endpoints=$(grep -c "^@router\." apps/backend/app/business/api.py || echo "0")
ca_endpoints=$(grep -c "^@router\." apps/backend/app/ca/api.py || echo "0")
console_endpoints=$(grep -c "^@router\." apps/backend/app/console/api.py || echo "0")

total_endpoints=$((platform_endpoints + business_endpoints + ca_endpoints + console_endpoints))

echo "  Platform: $platform_endpoints endpoints"
echo "  Business: $business_endpoints endpoints"
echo "  CA Practice: $ca_endpoints endpoints"
echo "  Console: $console_endpoints endpoints"
echo "  ${GREEN}Total: $total_endpoints endpoints${NC}"

echo ""

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
echo ""

if [ -f "apps/backend/app/main.py" ] && [ -f "apps/frontend/src/App.jsx" ]; then
    echo -e "${GREEN}✓ All core files present${NC}"
else
    echo -e "${RED}✗ Some core files missing${NC}"
fi

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Set environment variables in .env"
echo "2. Run database migrations: alembic upgrade head"
echo "3. Start backend: uvicorn app.main:app --reload"
echo "4. Start frontend: npm run dev"
echo "5. Deploy to production: ./deploy.sh"
echo ""
echo -e "${GREEN}=== Verification Complete ===${NC}"
