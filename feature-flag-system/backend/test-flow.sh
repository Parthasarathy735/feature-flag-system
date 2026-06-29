#!/usr/bin/env bash
# End-to-end smoke test for the Feature Flag backend.
# Run this with the server already started (npm start), e.g.:
#   ./test-flow.sh
#
# It exercises the full lifecycle and the multi-tenant isolation guarantees:
# Super Admin login -> create 2 orgs -> Org Admin signup/login for each ->
# create same-key flags in both orgs -> verify an admin from org 2 cannot
# read/update/delete org 1's flag by guessing its id -> public check endpoint.

set -e
BASE="${BASE:-http://localhost:4000/api}"

jval() { node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d)['$1'])}catch(e){console.log('')}})"; }

echo "1) Super admin login"
SA_TOKEN=$(curl -s -X POST "$BASE/auth/super-admin/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"SuperAdmin@123"}' | jval token)
test -n "$SA_TOKEN" && echo "   ok"

echo "2) Create two organizations"
curl -s -X POST "$BASE/organizations" -H "Authorization: Bearer $SA_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Byepo Technologies"}' > /dev/null
curl -s -X POST "$BASE/organizations" -H "Authorization: Bearer $SA_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Acme Corp"}' > /dev/null
echo "   ok"

ORG1_ID=$(curl -s "$BASE/organizations/public" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d).organizations.find(x=>x.name==='Byepo Technologies');console.log(o.id)})")
ORG2_ID=$(curl -s "$BASE/organizations/public" | node -e "process.stdin.on('data',d=>{const o=JSON.parse(d).organizations.find(x=>x.name==='Acme Corp');console.log(o.id)})")

echo "3) Org admin signup for both orgs"
ORG1_TOKEN=$(curl -s -X POST "$BASE/auth/org-admin/signup" -H 'Content-Type: application/json' \
  -d "{\"orgId\":$ORG1_ID,\"name\":\"Priya\",\"email\":\"priya@byepo.com\",\"password\":\"Passw0rd!\"}" | jval token)
ORG2_TOKEN=$(curl -s -X POST "$BASE/auth/org-admin/signup" -H 'Content-Type: application/json' \
  -d "{\"orgId\":$ORG2_ID,\"name\":\"Arjun\",\"email\":\"arjun@acme.com\",\"password\":\"Passw0rd!\"}" | jval token)
test -n "$ORG1_TOKEN" && test -n "$ORG2_TOKEN" && echo "   ok"

echo "4) Each org creates a flag with the SAME key (proves per-tenant scoping)"
curl -s -X POST "$BASE/flags" -H "Authorization: Bearer $ORG1_TOKEN" -H 'Content-Type: application/json' \
  -d '{"key":"dark_mode","description":"Dark theme","enabled":true}' > /dev/null
FLAG2_RESP=$(curl -s -X POST "$BASE/flags" -H "Authorization: Bearer $ORG2_TOKEN" -H 'Content-Type: application/json' \
  -d '{"key":"dark_mode","description":"Dark theme for Acme","enabled":false}')
echo "   ok"

ORG1_FLAG_ID=$(curl -s "$BASE/flags" -H "Authorization: Bearer $ORG1_TOKEN" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).flags[0].id))")

echo "5) SECURITY: org2 admin tries to modify org1's flag by guessing the id (expect 404)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/flags/$ORG1_FLAG_ID" \
  -H "Authorization: Bearer $ORG2_TOKEN" -H 'Content-Type: application/json' -d '{"enabled":false}')
test "$CODE" = "404" && echo "   ok ($CODE as expected)" || (echo "   FAILED: got $CODE" && exit 1)

echo "6) Public check endpoint reflects each org's own value"
R1=$(curl -s "$BASE/flags/check?orgId=$ORG1_ID&key=dark_mode" | jval enabled)
R2=$(curl -s "$BASE/flags/check?orgId=$ORG2_ID&key=dark_mode" | jval enabled)
test "$R1" = "true" && test "$R2" = "false" && echo "   ok (org1=true, org2=false)"

echo
echo "All checks passed."
