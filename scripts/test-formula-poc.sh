#!/bin/bash
# Formula-Based AI Architecture - Proof of Concept Tests
# Tests the new formula-based prompts with real AI calls

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")/.."

# Load API key
if [ -f ".env.local" ]; then
    source .env.local
    OPENAI_API_KEY="${VITE_OPENAI_API_KEY}"
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY not set${NC}"
    echo "Create .env.local with: VITE_OPENAI_API_KEY=your-key"
    exit 1
fi

API_URL="https://api.openai.com/v1/chat/completions"
MODEL="gpt-4o"
PASSED=0
FAILED=0

# Results file
RESULTS_FILE="/tmp/formula-poc-results.json"
echo "[]" > "$RESULTS_FILE"

# ============================================
# FORMULA SYSTEM PROMPT (Condensed for testing)
# ============================================
read -r -d '' FORMULA_SYSTEM_PROMPT << 'EOFPROMPT'
You are an architectural programmer. Output valid JSON with FORMULAS and REASONING - never calculated area values.

SCALE AWARENESS:
| Scale        | Area Range          | Breakdown                    |
|--------------|---------------------|------------------------------|
| interior     | 10-2,000 m²         | rooms, zones                 |
| architecture | 100-100,000 m²      | floors, departments, zones   |
| landscape    | 1K-500K m²          | buildings, outdoor, parking  |
| masterplan   | 10K-5M m²           | plots, streets, public space |
| urban        | 100K-100M m²        | neighborhoods, districts     |

TYPOLOGY SIZE CHECKS:
| Type          | Typical Range    |
|---------------|------------------|
| hotel         | 3K-50K m²        |
| hotel_resort  | 30K-500K m²      |
| office        | 2K-50K m²        |
| shopping_mall | 10K-300K m²      |

IF SIZE SEEMS WRONG - Ask clarification:
{
  "message": "⚠️ Size mismatch detected",
  "clarification_needed": true,
  "detected_scale": "urban",
  "expected_scale": "architecture", 
  "options": [
    { "label": "Corrected interpretation", "area": 50000, "scale": "architecture" },
    { "label": "Keep as masterplan", "area": 500000000, "scale": "urban" }
  ]
}

FORMULA TYPES:
1. ratio: { "type": "ratio", "reference": "total", "ratio": 0.35, "reasoning": "why", "confidence": { "level": 0.8, "factors": ["..."] } }
2. unit_based: { "type": "unit_based", "areaPerUnit": 35, "unitCount": 200, "reasoning": "why" }
3. remainder: { "type": "remainder", "parentRef": "total", "floor": 500, "reasoning": "absorbs leftover" }
4. fixed: { "type": "fixed", "value": 2000, "reasoning": "from brief", "source": { "type": "brief" } }
5. fallback: { "type": "fallback", "method": "typology_guess", "missingInfo": ["what's unknown"], "suggestedRatio": 0.05, "reasoning": "best guess", "confidence": { "level": 0.4, "factors": [] }, "userPrompts": ["question to ask"] }

OUTPUT FORMAT:
{
  "message": "Brief summary",
  "detected_scale": "architecture",
  "intent": {
    "type": "create_formula_program",
    "targetTotal": 15000,
    "areas": [
      { "name": "Area Name", "formula": { ... }, "groupHint": "Group" }
    ]
  }
}

RULES:
1. NEVER output calculated m² - only formulas
2. ALWAYS include reasoning
3. Use "fallback" when uncertain
4. Flag scale mismatches with clarification_needed
5. Detect appropriate scale from area size
EOFPROMPT

# ============================================
# Helper Functions
# ============================================

run_test() {
    local test_name="$1"
    local user_prompt="$2"
    local expected_checks="$3"
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Test: ${test_name}${NC}"
    echo -e "${BLUE}Input: ${user_prompt}${NC}"
    echo ""
    
    # Build request
    local request=$(jq -n \
        --arg model "$MODEL" \
        --arg system "$FORMULA_SYSTEM_PROMPT" \
        --arg user "$user_prompt" \
        '{
            model: $model,
            messages: [
                { role: "system", content: $system },
                { role: "user", content: $user }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
        }')
    
    # Call API
    local response=$(curl -s "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -d "$request")
    
    local content=$(echo "$response" | jq -r '.choices[0].message.content // empty')
    
    if [ -z "$content" ]; then
        echo -e "${RED}✗ No response${NC}"
        echo "$response" | jq '.error // .'
        ((FAILED++))
        return 1
    fi
    
    echo -e "${GREEN}Response:${NC}"
    echo "$content" | jq '.' 2>/dev/null || echo "$content"
    echo ""
    
    # Run checks
    local all_passed=true
    
    # Check 1: Valid JSON
    if echo "$content" | jq -e '.' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid JSON${NC}"
    else
        echo -e "${RED}✗ Invalid JSON${NC}"
        all_passed=false
    fi
    
    # Check 2: Has message
    if echo "$content" | jq -e '.message' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Has message${NC}"
    else
        echo -e "${RED}✗ Missing message${NC}"
        all_passed=false
    fi
    
    # Check 3: Has intent or clarification
    if echo "$content" | jq -e '.intent or .clarification_needed' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Has intent or clarification${NC}"
    else
        echo -e "${RED}✗ Missing intent/clarification${NC}"
        all_passed=false
    fi
    
    # Check 4: Formulas have reasoning (if intent exists)
    if echo "$content" | jq -e '.intent.areas' > /dev/null 2>&1; then
        local has_reasoning=$(echo "$content" | jq '[.intent.areas[].formula.reasoning] | all')
        if [ "$has_reasoning" = "true" ]; then
            echo -e "${GREEN}✓ All formulas have reasoning${NC}"
        else
            echo -e "${YELLOW}⚠ Some formulas missing reasoning${NC}"
        fi
        
        # Check: No raw m² values (formulas should have type, not direct numbers)
        local formula_types=$(echo "$content" | jq '[.intent.areas[].formula.type] | unique')
        echo -e "${BLUE}  Formula types used: $formula_types${NC}"
    fi
    
    # Custom checks based on test
    eval "$expected_checks"
    
    echo ""
    
    if $all_passed; then
        ((PASSED++))
        echo -e "${GREEN}━━━ PASSED ━━━${NC}"
    else
        ((FAILED++))
        echo -e "${RED}━━━ FAILED ━━━${NC}"
    fi
    
    # Save result
    local result=$(jq -n \
        --arg name "$test_name" \
        --arg input "$user_prompt" \
        --argjson response "$(echo "$content" | jq '.' 2>/dev/null || echo 'null')" \
        --argjson passed "$all_passed" \
        '{ name: $name, input: $input, response: $response, passed: $passed }')
    
    jq --argjson new "$result" '. += [$new]' "$RESULTS_FILE" > /tmp/tmp.json && mv /tmp/tmp.json "$RESULTS_FILE"
    
    echo ""
    sleep 1  # Rate limiting
}

# ============================================
# TEST CASES
# ============================================

echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Formula-Based Architecture - Proof of Concept Tests        ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# TEST 1: Normal Hotel (within range)
# ============================================
run_test "Normal Hotel - 15,000 m²" \
    "Create a 15,000 sqm hotel program with 200 rooms" \
    '
    if echo "$content" | jq -e ".intent.targetTotal == 15000" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Target total is 15000${NC}"
    else
        echo -e "${RED}✗ Wrong target total${NC}"
        all_passed=false
    fi
    
    if echo "$content" | jq -e ".detected_scale == \"architecture\"" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Correct scale: architecture${NC}"
    else
        local scale=$(echo "$content" | jq -r ".detected_scale // \"not set\"")
        echo -e "${YELLOW}⚠ Scale: $scale (expected architecture)${NC}"
    fi
    
    # Should have unit_based formula for rooms
    if echo "$content" | jq -e ".intent.areas[] | select(.formula.type == \"unit_based\")" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Uses unit_based formula for rooms${NC}"
    else
        echo -e "${YELLOW}⚠ Expected unit_based formula for rooms${NC}"
    fi
    '

# ============================================
# TEST 2: Massive Hotel (scale mismatch!)
# ============================================
run_test "Oversized Hotel - 500M m² (should trigger clarification)" \
    "Create a hotel of 500000000 sqm" \
    '
    if echo "$content" | jq -e ".clarification_needed == true" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Correctly flagged clarification needed${NC}"
        
        if echo "$content" | jq -e ".options | length > 0" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Provides alternative options${NC}"
            local options=$(echo "$content" | jq -r "[.options[].label] | join(\", \")")
            echo -e "${BLUE}  Options: $options${NC}"
        fi
    else
        echo -e "${RED}✗ Should have asked for clarification!${NC}"
        all_passed=false
    fi
    '

# ============================================
# TEST 3: Vague Input (should use fallback)
# ============================================
run_test "Vague Input - Should use fallback formulas" \
    "Create a program with some offices, storage, and other stuff. About 2000 sqm total." \
    '
    if echo "$content" | jq -e ".intent.areas[] | select(.formula.type == \"fallback\")" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Uses fallback formula for uncertain areas${NC}"
        
        local missing=$(echo "$content" | jq -r "[.intent.areas[] | select(.formula.type == \"fallback\") | .formula.missingInfo[0] // \"?\"] | first")
        echo -e "${BLUE}  Missing info flagged: $missing${NC}"
    else
        echo -e "${YELLOW}⚠ Expected fallback formula for vague areas${NC}"
    fi
    
    # Check confidence levels
    local low_conf=$(echo "$content" | jq "[.intent.areas[].formula.confidence.level // 1 | select(. < 0.5)] | length")
    if [ "$low_conf" -gt "0" ]; then
        echo -e "${GREEN}✓ Has low confidence on uncertain areas ($low_conf areas)${NC}"
    fi
    '

# ============================================
# TEST 4: Masterplan Scale
# ============================================
run_test "Masterplan - 500,000 m² mixed-use district" \
    "Create a 500,000 sqm masterplan for a mixed-use district with residential, commercial, and parks" \
    '
    if echo "$content" | jq -e ".detected_scale == \"masterplan\" or .detected_scale == \"landscape\"" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Correct scale for masterplan${NC}"
    else
        echo -e "${YELLOW}⚠ Expected masterplan/landscape scale${NC}"
    fi
    
    # Should NOT break down to room level
    if echo "$content" | jq -e ".intent.areas[] | select(.name | test(\"room|desk|bathroom\"; \"i\"))" > /dev/null 2>&1; then
        echo -e "${RED}✗ Broke down to room level - wrong for masterplan!${NC}"
        all_passed=false
    else
        echo -e "${GREEN}✓ Appropriate breakdown level (not rooms)${NC}"
    fi
    '

# ============================================
# TEST 5: Interior Scale
# ============================================
run_test "Interior - 150 m² apartment" \
    "Create a 150 sqm apartment layout with 3 bedrooms" \
    '
    if echo "$content" | jq -e ".detected_scale == \"interior\" or .detected_scale == \"architecture\"" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Correct scale: interior/architecture${NC}"
    fi
    
    # Should break down to room level
    if echo "$content" | jq -e ".intent.areas | length >= 5" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Has detailed room breakdown${NC}"
    fi
    '

# ============================================
# TEST 6: Remainder Formula Usage
# ============================================
run_test "BOH/Circulation should use remainder" \
    "Create a 10,000 sqm office: 60% workspace, rest is circulation and services" \
    '
    if echo "$content" | jq -e ".intent.areas[] | select(.formula.type == \"remainder\")" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Uses remainder formula for flexible areas${NC}"
    else
        echo -e "${YELLOW}⚠ Expected remainder formula for circulation/services${NC}"
    fi
    
    # Check ratio formulas add up reasonably
    local ratio_sum=$(echo "$content" | jq "[.intent.areas[].formula | select(.type == \"ratio\") | .ratio] | add // 0")
    echo -e "${BLUE}  Ratio sum: $ratio_sum (should be < 1 if remainder exists)${NC}"
    '

# ============================================
# TEST 7: Fixed Value from Brief
# ============================================
run_test "Fixed value from explicit requirement" \
    "Office building 5000 sqm. Parking MUST be exactly 800 sqm per zoning code." \
    '
    if echo "$content" | jq -e ".intent.areas[] | select(.formula.type == \"fixed\" and .formula.value == 800)" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Uses fixed formula for parking (800 m²)${NC}"
        
        if echo "$content" | jq -e ".intent.areas[] | select(.formula.type == \"fixed\") | .formula.source.type == \"brief\"" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Source marked as brief${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Expected fixed formula for explicit 800 m² parking${NC}"
    fi
    '

# ============================================
# TEST 8: Small Area Can't Split
# ============================================
run_test "Area too small to split meaningfully" \
    "Split this 15 sqm storage room into 5 different areas" \
    '
    # Should warn or refuse
    if echo "$content" | jq -e ".message | test(\"small|cannot|too|minimum\"; \"i\")" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Warns about small area${NC}"
    else
        echo -e "${YELLOW}⚠ Should warn about splitting tiny area${NC}"
    fi
    
    # If it does split, each part should hit minimum
    local min_area=$(echo "$content" | jq "[.intent.areas[].formula | select(.type == \"fixed\" or .type == \"ratio\") | .value // .ratio * 15] | min // 999")
    echo -e "${BLUE}  Minimum part: ~$min_area m²${NC}"
    '

# ============================================
# RESULTS SUMMARY
# ============================================
echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                    RESULTS SUMMARY                            ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""
echo "Full results saved to: $RESULTS_FILE"
echo ""

# Show any failed tests
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}Failed tests:${NC}"
    jq -r '.[] | select(.passed == false) | "  - \(.name)"' "$RESULTS_FILE"
fi

exit $FAILED
