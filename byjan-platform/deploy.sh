#!/bin/bash

# Byjan Platform Deployment Script
# Deploys backend to Render and frontend to Cloudflare Pages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="easypado.com"
API_DOMAIN="api.${DOMAIN}"
FRONTEND_DOMAIN="business.${DOMAIN}"

echo -e "${GREEN}=== Byjan Platform Deployment ===${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed${NC}"
    exit 1
fi

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed${NC}"
    exit 1
fi

# Check if wrangler is available (for Cloudflare)
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler is not installed. Install with: npm install -g wrangler${NC}"
    exit 1
fi

# Check if gh CLI is available (for GitHub)
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI is not installed. Install from https://cli.github.com/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Step 1: Build and test backend
echo -e "${YELLOW}Step 1: Building and testing backend...${NC}"

cd apps/backend

# Build Docker image
echo "Building Docker image..."
docker build -t byjan-backend:latest .

# Run tests
echo "Running tests..."
docker run --rm byjan-backend:latest pytest tests/ -v --tb=short

echo -e "${GREEN}✓ Backend tests passed${NC}"
echo ""

cd ../..

# Step 2: Build and test frontend
echo -e "${YELLOW}Step 2: Building and testing frontend...${NC}"

cd apps/frontend

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build frontend
echo "Building frontend..."
npm run build

echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

cd ../..

# Step 3: Deploy to Render
echo -e "${YELLOW}Step 3: Deploying backend to Render...${NC}"

# Check if render.yaml exists
if [ ! -f "apps/backend/render.yaml" ]; then
    echo -e "${RED}Error: render.yaml not found${NC}"
    exit 1
fi

# Commit changes to trigger Render deployment
echo "Committing changes..."
git add .
git commit -m "Deploy: $(date +%Y-%m-%d\ %H:%M:%S)" || true

# Push to GitHub (triggers Render deployment)
echo "Pushing to GitHub..."
git push origin byjan_business

echo -e "${GREEN}✓ Backend deployment triggered${NC}"
echo "Render will deploy to: https://${API_DOMAIN}"
echo ""

# Step 4: Deploy frontend to Cloudflare Pages
echo -e "${YELLOW}Step 4: Deploying frontend to Cloudflare Pages...${NC}"

cd apps/frontend

# Deploy to Cloudflare Pages
echo "Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=byjan-business-frontend

echo -e "${GREEN}✓ Frontend deployed${NC}"
echo "Frontend will be available at: https://${FRONTEND_DOMAIN}"
echo ""

cd ../..

# Step 5: Configure DNS (manual step)
echo -e "${YELLOW}Step 5: DNS Configuration${NC}"
echo ""
echo "Please configure DNS in Cloudflare:"
echo ""
echo "1. Go to https://dash.cloudflare.com"
echo "2. Select domain: ${DOMAIN}"
echo "3. Go to DNS → Records"
echo "4. Add these records:"
echo ""
echo "   Type    Name    Value                           Proxy Status"
echo "   A       api     [Render IP or CNAME]            DNS only"
echo "   CNAME   business  byjan-business-frontend.pages.dev  Proxied"
echo "   CNAME   app       byjan-business-frontend.pages.dev  Proxied"
echo ""
echo "5. Wait for DNS propagation (up to 24 hours)"
echo ""

# Step 6: Verify deployment
echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"
echo ""

# Check backend health
echo "Checking backend health..."
curl -f https://${API_DOMAIN}/health || echo -e "${RED}Backend health check failed${NC}"

# Check frontend
echo "Checking frontend..."
curl -f https://${FRONTEND_DOMAIN}/health || echo -e "${RED}Frontend health check failed${NC}"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "URLs:"
echo "  Frontend: https://${FRONTEND_DOMAIN}"
echo "  Backend:  https://${API_DOMAIN}"
echo "  Docs:     https://${API_DOMAIN}/docs"
echo "  Trace:    https://${FRONTEND_DOMAIN}/console"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for DNS propagation (up to 24 hours)"
echo "2. Configure environment variables in Render"
echo "3. Test the application end-to-end"
echo "4. Monitor logs in Render dashboard"
echo "5. Monitor traces in Cloudflare dashboard"
