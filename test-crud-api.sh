#!/bin/bash
# =====================================================
# WORSHIPOS CRUD API TESTING SCRIPT
# Test all the new endpoints
# =====================================================

API_BASE="http://localhost:3000"
ORG_ID="a8c2c7ab-836a-4ef1-a373-562e20babb76"

echo "=========================================="
echo "TESTING WORSHIPOS CRUD API"
echo "=========================================="
echo ""

# ==========================================
# TEST 1: Get all people
# ==========================================
echo "📋 TEST 1: Get all people"
curl -s "${API_BASE}/people?org_id=${ORG_ID}" | jq '.[0:3]'
echo ""
echo ""

# ==========================================
# TEST 2: Create a new person
# ==========================================
echo "✨ TEST 2: Create new person"
NEW_PERSON=$(curl -s -X POST "${API_BASE}/people" \
  -H "Content-Type: application/json" \
  -d "{
    \"org_id\": \"${ORG_ID}\",
    \"display_name\": \"Test Person $(date +%s)\"
  }")
echo "$NEW_PERSON" | jq '.'
NEW_PERSON_ID=$(echo "$NEW_PERSON" | jq -r '.id')
echo "Created person ID: $NEW_PERSON_ID"
echo ""
echo ""

# ==========================================
# TEST 3: Update person
# ==========================================
echo "✏️  TEST 3: Update person"
curl -s -X PUT "${API_BASE}/people/${NEW_PERSON_ID}" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Updated Test Person"}' | jq '.'
echo ""
echo ""

# ==========================================
# TEST 4: Get all roles
# ==========================================
echo "🎭 TEST 4: Get all roles"
curl -s "${API_BASE}/roles?org_id=${ORG_ID}" | jq '.[0:5] | .[] | {name, ministry_area}'
echo ""
echo ""

# ==========================================
# TEST 5: Get all songs
# ==========================================
echo "🎵 TEST 5: Get all songs"
curl -s "${API_BASE}/songs?org_id=${ORG_ID}" | jq '.[] | {title, artist, key, bpm}'
echo ""
echo ""

# ==========================================
# TEST 6: Search songs
# ==========================================
echo "🔍 TEST 6: Search for 'Way Maker'"
curl -s "${API_BASE}/songs?org_id=${ORG_ID}&search=way" | jq '.[] | {title, artist, key}'
echo ""
echo ""

# ==========================================
# TEST 7: Get all families
# ==========================================
echo "👨‍👩‍👧‍👦 TEST 7: Get all families"
curl -s "${API_BASE}/families?org_id=${ORG_ID}" | jq '.[] | {name, active_members, active_children}'
echo ""
echo ""

# ==========================================
# TEST 8: Get services with assignment status
# ==========================================
echo "📅 TEST 8: Get services with assignment status"
curl -s "${API_BASE}/services?org_id=${ORG_ID}" | jq '.[0:2] | .[] | {
  date: .group_date,
  name: .name,
  instances: .instances | length,
  first_instance_assignments: .instances[0].assignments | {
    total: .total_positions,
    filled: .filled_positions,
    confirmed: .confirmed,
    unfilled: .unfilled
  }
}'
echo ""
echo ""

# ==========================================
# TEST 9: Get context role requirements
# ==========================================
echo "📋 TEST 9: Get Sunday AM role requirements"
SUNDAY_AM_ID=$(curl -s "${API_BASE}/contexts?org_id=${ORG_ID}" | jq -r '.[] | select(.name == "Sunday AM") | .id')
if [ -n "$SUNDAY_AM_ID" ]; then
  curl -s "${API_BASE}/contexts/${SUNDAY_AM_ID}/role-requirements" | jq '.[0:5] | .[] | {
    role: .role_name,
    ministry: .ministry_area,
    min: .min_needed,
    max: .max_needed
  }'
else
  echo "Sunday AM context not found"
fi
echo ""
echo ""

# ==========================================
# TEST 10: Create a new role
# ==========================================
echo "✨ TEST 10: Create new role"
NEW_ROLE=$(curl -s -X POST "${API_BASE}/roles" \
  -H "Content-Type: application/json" \
  -d "{
    \"org_id\": \"${ORG_ID}\",
    \"name\": \"Test Role $(date +%s)\",
    \"ministry_area\": \"Test\",
    \"description\": \"This is a test role\"
  }")
echo "$NEW_ROLE" | jq '.'
NEW_ROLE_ID=$(echo "$NEW_ROLE" | jq -r '.id')
echo ""
echo ""

# ==========================================
# TEST 11: Create a new song
# ==========================================
echo "🎵 TEST 11: Create new song"
curl -s -X POST "${API_BASE}/songs" \
  -H "Content-Type: application/json" \
  -d "{
    \"org_id\": \"${ORG_ID}\",
    \"title\": \"Test Song $(date +%s)\",
    \"artist\": \"Test Artist\",
    \"key\": \"G\",
    \"bpm\": 120,
    \"notes\": \"This is a test song\"
  }" | jq '.'
echo ""
echo ""

# ==========================================
# TEST 12: Create a new family
# ==========================================
echo "👨‍👩‍👧‍👦 TEST 12: Create new family"
NEW_FAMILY=$(curl -s -X POST "${API_BASE}/families" \
  -H "Content-Type: application/json" \
  -d "{
    \"org_id\": \"${ORG_ID}\",
    \"name\": \"Test Family $(date +%s)\",
    \"notes\": \"This is a test family\"
  }")
echo "$NEW_FAMILY" | jq '.'
NEW_FAMILY_ID=$(echo "$NEW_FAMILY" | jq -r '.id')
echo ""
echo ""

# ==========================================
# TEST 13: Add person to family
# ==========================================
if [ -n "$NEW_PERSON_ID" ] && [ -n "$NEW_FAMILY_ID" ]; then
  echo "👤 TEST 13: Add person to family"
  curl -s -X POST "${API_BASE}/families/${NEW_FAMILY_ID}/members" \
    -H "Content-Type: application/json" \
    -d "{
      \"org_id\": \"${ORG_ID}\",
      \"person_id\": \"${NEW_PERSON_ID}\",
      \"relationship\": \"parent\",
      \"is_primary_contact\": true
    }" | jq '.'
  echo ""
  echo ""
fi

# ==========================================
# TEST 14: Get family detail with members
# ==========================================
if [ -n "$NEW_FAMILY_ID" ]; then
  echo "👨‍👩‍👧 TEST 14: Get family detail"
  curl -s "${API_BASE}/families/${NEW_FAMILY_ID}" | jq '{
    name: .name,
    members: .members | .[] | {
      name: .display_name,
      relationship: .relationship,
      is_primary: .is_primary_contact
    }
  }'
  echo ""
  echo ""
fi

# ==========================================
# CLEANUP (Optional)
# ==========================================
echo "🧹 Cleanup test data? (y/n)"
read -t 5 -n 1 CLEANUP || CLEANUP="n"
echo ""

if [ "$CLEANUP" = "y" ]; then
  echo "Cleaning up test data..."
  
  # Delete test person
  if [ -n "$NEW_PERSON_ID" ]; then
    curl -s -X DELETE "${API_BASE}/people/${NEW_PERSON_ID}"
    echo "Deleted test person"
  fi
  
  # Delete test role
  if [ -n "$NEW_ROLE_ID" ]; then
    curl -s -X DELETE "${API_BASE}/roles/${NEW_ROLE_ID}"
    echo "Deleted test role"
  fi
  
  echo "Cleanup complete!"
else
  echo "Skipping cleanup (test data remains)"
fi

echo ""
echo "=========================================="
echo "TESTING COMPLETE!"
echo "=========================================="
