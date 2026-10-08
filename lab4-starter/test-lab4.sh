#!/usr/bin/env bash
# Runs curl tests against the Lab 4 starter API and compares status codes.
#   bash test-lab4.sh [path/to/lab4.env]    (default: ./lab4.env)
# Uses synthetic event TRN900 and deletes it at the end.

set -uo pipefail

ENV_FILE="${1:-$PWD/lab4.env}"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE. Run setup-lab4.sh first." >&2
    exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${API_URL:?API_URL is missing from $ENV_FILE}"

PASS=0
FAIL=0

# check <expected-status> <description> <curl args...>
check() {
    local expected="$1" description="$2"
    shift 2
    local body status
    body="$(mktemp)"
    status="$(curl -s -o "$body" -w '%{http_code}' "$@")"
    if [[ "$status" == "$expected" ]]; then
        printf 'PASS  %-45s %s\n' "$description" "$status"
        PASS=$((PASS + 1))
    else
        printf 'FAIL  %-45s expected %s, got %s\n' "$description" "$expected" "$status"
        FAIL=$((FAIL + 1))
    fi
    printf '      %s\n' "$(head -c 300 "$body")"
    rm -f "$body"
}

echo "API_URL: $API_URL"
echo

# Start from a clean state in case a previous run stopped midway.
curl -s -o /dev/null -X DELETE "$API_URL/events/TRN900"

check 200 "GET /events"                    "$API_URL/events"
check 200 "GET /events/TRN001"             "$API_URL/events/TRN001"
check 404 "GET /events/UNKNOWN"            "$API_URL/events/UNKNOWN"

check 201 "POST /events (TRN900)" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"eventId":"TRN900","title":"Operational Review","status":"DRAFT"}' \
    "$API_URL/events"
check 409 "POST /events (duplicate TRN900)" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"eventId":"TRN900","title":"Duplicate Test","status":"DRAFT"}' \
    "$API_URL/events"
check 400 "POST /events (missing title)" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"eventId":"TRN901"}' \
    "$API_URL/events"
check 400 "POST /events (malformed JSON)" -X POST \
    -H 'Content-Type: application/json' \
    -d '{"eventId":"TRN902",' \
    "$API_URL/events"

check 200 "PUT /events/TRN900" -X PUT \
    -H 'Content-Type: application/json' \
    -d '{"status":"PUBLISHED"}' \
    "$API_URL/events/TRN900"
check 400 "PUT /events/TRN900 (missing status)" -X PUT \
    -H 'Content-Type: application/json' \
    -d '{}' \
    "$API_URL/events/TRN900"
check 404 "PUT /events/UNKNOWN" -X PUT \
    -H 'Content-Type: application/json' \
    -d '{"status":"PUBLISHED"}' \
    "$API_URL/events/UNKNOWN"

check 204 "DELETE /events/TRN900"          -X DELETE "$API_URL/events/TRN900"
check 404 "GET /events/TRN900 (deleted)"   "$API_URL/events/TRN900"
check 404 "DELETE /events/TRN900 (again)"  -X DELETE "$API_URL/events/TRN900"

echo
echo "Passed: $PASS  Failed: $FAIL"
[[ "$FAIL" -eq 0 ]]
