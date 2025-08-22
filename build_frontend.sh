#!/bin/bash
# Build frontend with proper error handling

echo "========================================="
echo "Building DNNE Frontend..."
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we're in the right directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}Step 1: Running TypeScript type checking...${NC}"
if npm run typecheck; then
    echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
    echo -e "${RED}✗ TypeScript check FAILED!${NC}"
    echo -e "${RED}Fix the TypeScript errors above before the build can continue.${NC}"
    echo -e "${RED}Build ABORTED.${NC}"
    exit 1
fi

echo
echo -e "${YELLOW}Step 2: Building with Vite...${NC}"
if npm run build; then
    echo -e "${GREEN}✓ Vite build completed successfully${NC}"
    
    # Verify dist was created properly
    if [ -d "dist/assets" ] && [ -f "dist/index.html" ]; then
        echo -e "${GREEN}✓ Distribution files created successfully${NC}"
        
        # Count the assets
        JS_COUNT=$(find dist/assets -name "*.js" 2>/dev/null | wc -l)
        CSS_COUNT=$(find dist/assets -name "*.css" 2>/dev/null | wc -l)
        echo -e "${GREEN}  Created $JS_COUNT JavaScript files and $CSS_COUNT CSS files${NC}"
    else
        echo -e "${RED}✗ WARNING: dist directory seems incomplete!${NC}"
        echo -e "${RED}  Expected dist/assets and dist/index.html but they're missing${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Vite build FAILED!${NC}"
    echo -e "${RED}Check the errors above.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Frontend build completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo
echo "The built files are in: $SCRIPT_DIR/dist/"
echo "Server should serve from: ../DNNE-UI-Frontend/dist"