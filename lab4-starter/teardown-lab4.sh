#!/usr/bin/env bash
# Removes the resources created by setup-lab4.sh so the lab can be redone.
#   bash teardown-lab4.sh [path/to/lab4.env]    (default: ./lab4.env)
# Add -y as the last argument to skip the confirmation prompt.

set -euo pipefail

ENV_FILE="${1:-$PWD/lab4.env}"
[[ "$ENV_FILE" == "-y" ]] && ENV_FILE="$PWD/lab4.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    echo "Run this from the folder where setup-lab4.sh was run, or pass the file path." >&2
    exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"
export AWS_PAGER=""

for var in AWS_DEFAULT_REGION TABLE_NAME LAMBDA_FUNCTION_NAME API_ID; do
    if [[ -z "${!var:-}" ]]; then
        echo "$var is missing from $ENV_FILE" >&2
        exit 1
    fi
done

# Guard against deleting anything that was not created by the starter script.
for name in "$TABLE_NAME" "$LAMBDA_FUNCTION_NAME"; do
    if [[ "$name" != *-lab4 ]]; then
        echo "Refusing to delete '$name': name does not end in -lab4." >&2
        exit 1
    fi
done

echo "Region:          $AWS_DEFAULT_REGION"
echo "REST API:        $API_ID"
echo "Lambda function: $LAMBDA_FUNCTION_NAME"
echo "DynamoDB table:  $TABLE_NAME (all items will be lost)"
echo "Log group:       /aws/lambda/$LAMBDA_FUNCTION_NAME"

if [[ "${*: -1}" != "-y" ]]; then
    read -r -p "Type 'yes' to delete these resources: " answer
    [[ "$answer" == "yes" ]] || { echo "Cancelled."; exit 0; }
fi

echo
echo "==> Deleting REST API"
aws apigateway delete-rest-api --rest-api-id "$API_ID" 2>/dev/null \
    && echo "  deleted" || echo "  not found or already deleted"

echo "==> Deleting Lambda function"
aws lambda delete-function --function-name "$LAMBDA_FUNCTION_NAME" 2>/dev/null \
    && echo "  deleted" || echo "  not found or already deleted"

echo "==> Deleting Lambda log group"
aws logs delete-log-group --log-group-name "/aws/lambda/$LAMBDA_FUNCTION_NAME" 2>/dev/null \
    && echo "  deleted" || echo "  not found or not permitted"

echo "==> Deleting DynamoDB table"
if aws dynamodb delete-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
    aws dynamodb wait table-not-exists --table-name "$TABLE_NAME"
    echo "  deleted"
else
    echo "  not found or already deleted"
fi

rm -f "$ENV_FILE"
echo
echo "Teardown complete. Run 'bash setup-lab4.sh' to start the lab again."
