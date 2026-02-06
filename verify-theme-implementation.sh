#!/bin/bash

echo "🔍 Verifying Phase 2: Theme Engine Implementation"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
TOTAL=0
PASSED=0
FAILED=0

check_file() {
    TOTAL=$((TOTAL + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

check_content() {
    TOTAL=$((TOTAL + 1))
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $3"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $3"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

BASE_PATH="/Users/pacomedomagni/Documents/platform/apps/web/src/lib"

echo "📁 Checking Core Files..."
check_file "$BASE_PATH/theme/types.ts" "types.ts exists"
check_file "$BASE_PATH/theme/theme-provider.tsx" "theme-provider.tsx exists"
check_file "$BASE_PATH/theme/theme-engine.ts" "theme-engine.ts exists"
check_file "$BASE_PATH/theme/theme-utils.ts" "theme-utils.ts exists"
check_file "$BASE_PATH/theme/use-theme.ts" "use-theme.ts exists"
check_file "$BASE_PATH/theme/font-loader.tsx" "font-loader.tsx exists"
check_file "$BASE_PATH/theme/theme-loading.tsx" "theme-loading.tsx exists"
check_file "$BASE_PATH/theme/index.ts" "index.ts exists"

echo ""
echo "🔌 Checking API Client..."
check_file "$BASE_PATH/api/themes.ts" "themes.ts API client exists"

echo ""
echo "📚 Checking Documentation..."
check_file "$BASE_PATH/theme/README.md" "README.md exists"
check_file "$BASE_PATH/theme/QUICK_START.md" "QUICK_START.md exists"
check_file "$BASE_PATH/theme/INTEGRATION.md" "INTEGRATION.md exists"
check_file "$BASE_PATH/theme/ARCHITECTURE.md" "ARCHITECTURE.md exists"

echo ""
echo "🧪 Checking Tests..."
check_file "$BASE_PATH/theme/__tests__/theme-utils.test.ts" "theme-utils.test.ts exists"

echo ""
echo "💡 Checking Examples..."
check_file "$BASE_PATH/theme/examples/themed-card.tsx" "themed-card.tsx example exists"

echo ""
echo "🔍 Checking Key Functionality..."
check_content "$BASE_PATH/theme/theme-provider.tsx" "ThemeProvider" "ThemeProvider component defined"
check_content "$BASE_PATH/theme/use-theme.ts" "useTheme" "useTheme hook defined"
check_content "$BASE_PATH/theme/theme-engine.ts" "applyTheme" "applyTheme function defined"
check_content "$BASE_PATH/theme/theme-utils.ts" "hexToHSL" "hexToHSL utility defined"
check_content "$BASE_PATH/api/themes.ts" "themesApi" "themesApi client defined"

echo ""
echo "🔗 Checking Integration..."
STORE_PROVIDERS="/Users/pacomedomagni/Documents/platform/apps/web/src/app/storefront/_components/store-providers.tsx"
check_content "$STORE_PROVIDERS" "ThemeProvider" "ThemeProvider integrated in storefront"
check_content "$STORE_PROVIDERS" "FontLoader" "FontLoader integrated in storefront"

echo ""
echo "📊 Statistics..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Checks: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

# Calculate lines of code
echo ""
echo "📈 Code Statistics..."
THEME_LOC=$(find "$BASE_PATH/theme" -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
API_LOC=$(wc -l < "$BASE_PATH/api/themes.ts" 2>/dev/null)
echo "Theme System: ~$THEME_LOC lines"
echo "API Client: ~$API_LOC lines"
echo "Total: ~$((THEME_LOC + API_LOC)) lines"

# File count
echo ""
echo "📂 File Count..."
TS_FILES=$(find "$BASE_PATH/theme" -name "*.ts" 2>/dev/null | wc -l)
TSX_FILES=$(find "$BASE_PATH/theme" -name "*.tsx" 2>/dev/null | wc -l)
MD_FILES=$(find "$BASE_PATH/theme" -name "*.md" 2>/dev/null | wc -l)
echo "TypeScript files: $TS_FILES"
echo "React components: $TSX_FILES"
echo "Documentation: $MD_FILES"
echo "Total files: $((TS_FILES + TSX_FILES + MD_FILES + 1))" # +1 for API client

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Phase 2 is complete.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks failed. Please review.${NC}"
    exit 1
fi
