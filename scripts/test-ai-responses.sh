#!/bin/bash
# AI Response Format Test Script
# Tests OpenAI API responses match expected schemas

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")/.."

# Load API key
if [ -f ".env.local" ]; then
    source .env.local
    OPENAI_API_KEY="${VITE_OPENAI_API_KEY}"
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY not set${NC}"
    exit 1
fi

API_URL="https://api.openai.com/v1/chat/completions"

echo -e "${YELLOW}=== AI Response Format Tests ===${NC}"
echo ""

# Test 1: Agent Mode - Split Area
echo -e "${YELLOW}Test 1: Agent Mode - Split Area Proposal${NC}"

cat > /tmp/test1.json << 'EOF'
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are an architectural brief assistant in AGENT mode. Propose concrete changes only, no explanations. Keep message under 200 characters. Use m². OUTPUT FORMAT (JSON only): {\"message\": \"Brief description\", \"proposals\": [{\"type\": \"split_area\", \"sourceNodeId\": \"uuid\", \"sourceName\": \"Name\", \"splits\": [{\"name\": \"Part\", \"areaPerUnit\": 100, \"count\": 1}]}]}"},
    {"role": "system", "content": "Selected Areas:\n- ID: \"abc-123-def\" | Name: \"Office Space\" | 1 × 500m² = 500m² total"},
    {"role": "user", "content": "Split the office space into different work areas"}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.3
}
EOF

RESPONSE1=$(curl -s "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @/tmp/test1.json)

echo "Response:"
CONTENT1=$(echo "$RESPONSE1" | jq -r '.choices[0].message.content // empty')
if [ -n "$CONTENT1" ]; then
    echo "$CONTENT1" | jq '.'
    
    if echo "$CONTENT1" | jq -e '.message and .proposals' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid agent response structure${NC}"
        
        if echo "$CONTENT1" | jq -e '.proposals[0].type == "split_area"' > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Contains split_area proposal${NC}"
        else
            echo -e "${YELLOW}⚠ Wrong proposal type${NC}"
        fi
        
        if echo "$CONTENT1" | jq -e '.proposals[0].sourceNodeId and .proposals[0].splits' > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Has required fields${NC}"
        else
            echo -e "${RED}✗ Missing required fields${NC}"
        fi
    else
        echo -e "${RED}✗ Invalid structure${NC}"
    fi
else
    echo -e "${RED}✗ No response - Error:${NC}"
    echo "$RESPONSE1" | jq '.error // .'
fi

echo ""

# Test 2: Consultation Mode
echo -e "${YELLOW}Test 2: Consultation Mode - Q&A${NC}"

cat > /tmp/test2.json << 'EOF'
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are an architectural consultant. Answer questions with reasoning. OUTPUT FORMAT (JSON only): {\"message\": \"Answer\", \"reasoning\": \"Detailed reasoning\", \"references\": []}"},
    {"role": "user", "content": "What is the typical size for a hotel lobby serving 200 rooms?"}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.3
}
EOF

RESPONSE2=$(curl -s "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @/tmp/test2.json)

CONTENT2=$(echo "$RESPONSE2" | jq -r '.choices[0].message.content // empty')
if [ -n "$CONTENT2" ]; then
    echo "$CONTENT2" | jq '.'
    
    if echo "$CONTENT2" | jq -e '.message' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid consultation response${NC}"
        
        if ! echo "$CONTENT2" | jq -e '.proposals' > /dev/null 2>&1; then
            echo -e "${GREEN}✓ No proposals (correct for consultation)${NC}"
        fi
    else
        echo -e "${RED}✗ Invalid structure${NC}"
    fi
else
    echo -e "${RED}✗ No response${NC}"
fi

echo ""

# Test 3: Brief Parsing
echo -e "${YELLOW}Test 3: Brief Parsing${NC}"

cat > /tmp/test3.json << 'EOF'
{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "Parse this brief and extract spaces. OUTPUT FORMAT (JSON): {\"areas\": [{\"name\": \"\", \"areaPerUnit\": 0, \"count\": 1, \"briefNote\": \"\"}], \"suggestedAreas\": [{\"name\": \"\", \"areaPerUnit\": 0, \"count\": 1, \"aiNote\": \"\"}], \"projectContext\": \"\", \"ambiguities\": []}\n\nBrief: Small office for 20 developers (8sqm each), 2 meeting rooms, kitchen, reception. Total ~350sqm."}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.2
}
EOF

RESPONSE3=$(curl -s "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @/tmp/test3.json)

CONTENT3=$(echo "$RESPONSE3" | jq -r '.choices[0].message.content // empty')
if [ -n "$CONTENT3" ]; then
    echo "$CONTENT3" | jq '.'
    
    if echo "$CONTENT3" | jq -e '.areas and .projectContext' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Valid brief parsing response${NC}"
        
        AREA_COUNT=$(echo "$CONTENT3" | jq '.areas | length')
        echo -e "${GREEN}✓ Extracted $AREA_COUNT areas${NC}"
    else
        echo -e "${RED}✗ Invalid structure${NC}"
    fi
else
    echo -e "${RED}✗ No response${NC}"
fi

echo ""

# Test 4: Add Notes
echo -e "${YELLOW}Test 4: Add Notes Proposal${NC}"

cat > /tmp/test4.json << 'EOF'
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are an architectural assistant. Add notes to areas. OUTPUT FORMAT (JSON): {\"message\": \"Description\", \"proposals\": [{\"type\": \"add_notes\", \"notes\": [{\"targetType\": \"area\", \"targetId\": \"uuid\", \"targetName\": \"Name\", \"content\": \"Note\", \"reason\": \"Why\"}]}]}"},
    {"role": "system", "content": "Selected Areas:\n- ID: \"storage-001\" | Name: \"Cold Storage\" | 50m²\n- ID: \"storage-002\" | Name: \"Dry Storage\" | 80m²"},
    {"role": "user", "content": "Add notes explaining why we need separate storage areas"}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.3
}
EOF

RESPONSE4=$(curl -s "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @/tmp/test4.json)

CONTENT4=$(echo "$RESPONSE4" | jq -r '.choices[0].message.content // empty')
if [ -n "$CONTENT4" ]; then
    echo "$CONTENT4" | jq '.'
    
    if echo "$CONTENT4" | jq -e '.proposals[0].type == "add_notes"' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Contains add_notes proposal${NC}"
        
        if echo "$CONTENT4" | jq -e '.proposals[0].notes[0].content' > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Notes have content${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Wrong proposal type${NC}"
    fi
else
    echo -e "${RED}✗ No response${NC}"
fi

echo ""
echo -e "${YELLOW}=== Tests Complete ===${NC}"

# Cleanup
rm -f /tmp/test1.json /tmp/test2.json /tmp/test3.json /tmp/test4.json
