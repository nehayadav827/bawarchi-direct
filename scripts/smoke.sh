#!/usr/bin/env bash
# End-to-end smoke test against a running server: BASE=http://localhost:3000 bash scripts/smoke.sh
# Needs the demo seed (SEED_DEMO=true or a non-production run). Exits non-zero if any check fails.
set -u
B="${BASE:-http://localhost:3000}"; PW='Demo@1234'; J='content-type: application/json'
T=$(mktemp -d); fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (expected $2, got $3)"; fail=1; fi; }
code() { curl -s -m 20 -o "$T/body" -w '%{http_code}' "$@"; }
login() { curl -s -m 20 -c "$T/$1.jar" -X POST "$B/api/auth/login" -H "$J" -d "{\"email\":\"$2\",\"password\":\"$PW\"}" >/dev/null; }
field() { python3 -c "import sys,json;print(json.load(open('$T/body'))$1)"; }
atleast1() { awk '{print ($1>=1)?1:0}'; }

check "anonymous order is rejected" 401 "$(code -X POST "$B/api/orders" -H "$J" -d '{}')"
check "bad password is rejected" 401 "$(code -X POST "$B/api/auth/login" -H "$J" -d '{"email":"customer@demo.test","password":"nope"}')"
login c customer@demo.test; login k manager.kondapur@demo.test; login a admin@demo.test
check "menu loads" 200 "$(code "$B/api/outlets/kondapur/menu")"; check "menu says prices include GST" True "$(field "['pricesIncludeGst']")"
check "outlets by location" 200 "$(code "$B/api/outlets?lat=17.46&lng=78.365")"
check "quote applies coupon" 200 "$(code -b "$T/c.jar" -X POST "$B/api/orders/quote" -H "$J" -d '{"outletId":"kondapur","couponCode":"direct10","lines":[{"itemId":"mutton-dum-biryani","qty":2,"portion":"Regular"}]}')"
check "quote discount is 10 percent" 8980 "$(field "['discountPaise']")"
check "declined payment creates no order" 402 "$(code -b "$T/c.jar" -X POST "$B/api/orders" -H "$J" -d '{"outletId":"kondapur","lines":[{"itemId":"veg-biryani","qty":1}],"payment":{"method":"UPI","vpa":"fail@test"}}')"
check "order is placed" 201 "$(code -b "$T/c.jar" -X POST "$B/api/orders" -H "$J" -d '{"outletId":"kondapur","lines":[{"itemId":"chicken-dum-biryani","qty":1,"portion":"Regular"}],"payment":{"method":"UPI","vpa":"demo@okbank"}}')"
OID=$(field "['id']")
check "customer can read own order" 200 "$(code -b "$T/c.jar" "$B/api/orders/$OID")"

(timeout 8 curl -s -N -b "$T/k.jar" "$B/api/kitchen/kondapur/stream" > "$T/sse") & sleep 3
check "kitchen starts the order" 200 "$(code -b "$T/k.jar" -X POST "$B/api/kitchen/orders/$OID/status" -H "$J" -d '{"to":"PREPARING"}')"
check "illegal jump is rejected" 409 "$(code -b "$T/k.jar" -X POST "$B/api/kitchen/orders/$OID/status" -H "$J" -d '{"to":"HANDED_OFF"}')"
check "manager overrides the promise" 200 "$(code -b "$T/k.jar" -X POST "$B/api/kitchen/orders/$OID/promise" -H "$J" -d '{"minutes":50}')"
wait
check "SSE announced the status change" 1 "$(grep -c STATUS_CHANGED "$T/sse" | atleast1)"
check "SSE announced the promise change" 1 "$(grep -c PROMISE_UPDATED "$T/sse" | atleast1)"
check "kitchen list" 200 "$(code -b "$T/k.jar" "$B/api/kitchen/kondapur/orders")"
check "staff cannot read another outlet" 403 "$(code -b "$T/k.jar" "$B/api/kitchen/kukatpally/orders")"
check "customer cannot read kitchen" 403 "$(code -b "$T/c.jar" "$B/api/kitchen/kondapur/orders")"
check "pause item" 200 "$(code -b "$T/k.jar" -X POST "$B/api/kitchen/kondapur/stock" -H "$J" -d '{"itemId":"veg-biryani","available":false}')"
check "paused item cannot be ordered" 409 "$(code -b "$T/c.jar" -X POST "$B/api/orders" -H "$J" -d '{"outletId":"kondapur","lines":[{"itemId":"veg-biryani","qty":1}],"payment":{"method":"UPI","vpa":"demo@okbank"}}')"
check "resume item" 200 "$(code -b "$T/k.jar" -X POST "$B/api/kitchen/kondapur/stock" -H "$J" -d '{"itemId":"veg-biryani","available":true}')"
check "kitchen cannot use menu admin" 403 "$(code -b "$T/k.jar" "$B/api/admin/menu")"
check "admin edits a price" 200 "$(code -b "$T/a.jar" -X PATCH "$B/api/admin/menu/veg-biryani" -H "$J" -d '{"basePaise":26000}')"
for p in / /login /menu/kondapur /checkout /admin /kitchen/kondapur; do check "page $p" 200 "$(code "$B$p")"; done
rm -rf "$T"; exit $fail
