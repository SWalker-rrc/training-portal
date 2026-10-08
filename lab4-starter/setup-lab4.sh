#!/usr/bin/env bash
# COMP-3020 Module 2B Tutorial 4 starter environment.
# Recreates the Tutorial 3 end state (DynamoDB table, Lambda function, REST API)
# with every resource name suffixed "-lab4".
#
# Run on the course EC2 instance that has the LabRole instance profile attached:
#   bash setup-lab4.sh
# Safe to re-run: existing resources are reused and the Lambda code is refreshed.

set -euo pipefail

SUFFIX="-lab4"
TABLE_NAME="YMBTrainingEvents${SUFFIX}"
LAMBDA_FUNCTION_NAME="ymb-training-events-api${SUFFIX}"
API_NAME="ymb-training-api${SUFFIX}"
STAGE_NAME="dev"
RUNTIME="${RUNTIME:-python3.14}"
ENV_FILE="${ENV_FILE:-$PWD/lab4.env}"

log() { printf '\n==> %s\n' "$*"; }

# ---------------------------------------------------------------------------
# Region and account
# ---------------------------------------------------------------------------
detect_region() {
    if [[ -n "${AWS_DEFAULT_REGION:-}" ]]; then echo "$AWS_DEFAULT_REGION"; return; fi
    if [[ -n "${AWS_REGION:-}" ]]; then echo "$AWS_REGION"; return; fi
    local region
    region="$(aws configure get region 2>/dev/null || true)"
    if [[ -n "$region" ]]; then echo "$region"; return; fi
    local token
    token="$(curl -s -m 2 -X PUT 'http://169.254.169.254/latest/api/token' \
        -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
    region="$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $token" \
        'http://169.254.169.254/latest/meta-data/placement/region' || true)"
    echo "${region:-us-east-1}"
}

export AWS_DEFAULT_REGION="$(detect_region)"
export AWS_PAGER=""

log "Checking AWS identity"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CALLER_ARN="$(aws sts get-caller-identity --query Arn --output text)"
if [[ "$CALLER_ARN" != *"LabRole"* ]]; then
    echo "WARNING: caller is not LabRole. Run this on the EC2 instance with LabRole attached." >&2
fi
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/LabRole"
echo "Region:  $AWS_DEFAULT_REGION"
echo "Role:    $ROLE_ARN"

# ---------------------------------------------------------------------------
# DynamoDB
# ---------------------------------------------------------------------------
log "DynamoDB table: $TABLE_NAME"
if aws dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
    echo "Table already exists; reusing it."
else
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions AttributeName=eventId,AttributeType=S \
        --key-schema AttributeName=eventId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST >/dev/null
fi
aws dynamodb wait table-exists --table-name "$TABLE_NAME"

log "Seeding synthetic training events TRN001 and TRN002"
aws dynamodb put-item --table-name "$TABLE_NAME" \
    --item '{"eventId":{"S":"TRN001"},"title":{"S":"AWS Lambda Fundamentals"},"status":{"S":"PUBLISHED"}}'
aws dynamodb put-item --table-name "$TABLE_NAME" \
    --item '{"eventId":{"S":"TRN002"},"title":{"S":"Cloud Security Workshop"},"status":{"S":"DRAFT"}}'

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

# Tutorial 3 final handler (lambda_function_v05.py).
cat > "$BUILD_DIR/lambda_function.py" <<'PY'
from __future__ import annotations
import os
import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

db = boto3.resource("dynamodb")
table = db.Table(os.environ["TABLE_NAME"])

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def response(status_code, body):
    """Helper to format API Gateway responses."""
    return {"statusCode": status_code, "body": json.dumps(body)}


def event_id_from_path(event: dict[str, Any]) -> str | None:
    """Read and normalize the eventId path parameter."""
    path_parameters = event.get("pathParameters") or {}
    event_id = path_parameters.get("eventId")
    if not isinstance(event_id, str) or not event_id.strip():
        return None
    return event_id.strip()


def json_body(event: dict[str, Any]) -> dict[str, Any] | None:
    """Parse a JSON object request body."""
    body = event.get("body")
    if not isinstance(body, str):
        return None
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def get_event(event: dict[str, Any]) -> dict[str, Any]:
    """Retrieve one training event."""
    event_id = event_id_from_path(event)
    if event_id is None:
        return response(400, {"message": "eventId is required"})

    item = table.get_item(Key={"eventId": event_id}).get("Item")
    if item is None:
        return response(404, {"message": "Training event not found"})

    logger.info("training_event_read event_id=%s", event_id)
    return response(200, item)


def list_events(event: dict[str, Any]) -> dict[str, Any]:
    """List all training events."""
    items = table.scan().get("Items", [])
    return response(200, {"events": items})


def create_event(event: dict[str, Any]) -> dict[str, Any]:
    """Create one training event without overwriting an existing key."""
    payload = json_body(event)
    if payload is None:
        return response(400, {"message": "Request body must be a JSON object"})

    event_id = payload.get("eventId")
    title = payload.get("title")
    status = payload.get("status", "DRAFT")

    if not all(
        isinstance(value, str) and value.strip() for value in (event_id, title, status)
    ):
        return response(400, {"message": "eventId, title, and status are required"})

    item = {
        "eventId": event_id.strip(),
        "title": title.strip(),
        "status": status.strip(),
    }

    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(eventId)",
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "Unknown")
        if code == "ConditionalCheckFailedException":
            return response(409, {"message": "eventId already exists"})
        logger.exception("training_event_create_failed error_code=%s", code)
        return response(500, {"message": "Unable to create training event"})

    logger.info("training_event_created event_id=%s", item["eventId"])
    return response(201, item)


def update_event(event: dict[str, Any]) -> dict[str, Any]:
    """Update the status of an existing training event."""
    event_id = event_id_from_path(event)
    payload = json_body(event)
    if event_id is None or payload is None:
        return response(400, {"message": "eventId and a JSON body are required"})

    status = payload.get("status")
    if not isinstance(status, str) or not status.strip():
        return response(400, {"message": "status is required"})

    try:
        result = table.update_item(
            Key={"eventId": event_id},
            UpdateExpression="SET #status = :status",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":status": status.strip()},
            ConditionExpression="attribute_exists(eventId)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "Unknown")
        if code == "ConditionalCheckFailedException":
            return response(404, {"message": "Training event not found"})
        logger.exception("training_event_update_failed error_code=%s", code)
        return response(500, {"message": "Unable to update training event"})

    logger.info("training_event_updated event_id=%s", event_id)
    return response(200, result["Attributes"])


def delete_event(event: dict[str, Any]) -> dict[str, Any]:
    """Delete one existing training event."""
    event_id = event_id_from_path(event)
    if event_id is None:
        return response(400, {"message": "eventId is required"})

    try:
        table.delete_item(
            Key={"eventId": event_id},
            ConditionExpression="attribute_exists(eventId)",
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "Unknown")
        if code == "ConditionalCheckFailedException":
            return response(404, {"message": "Training event not found"})
        logger.exception("training_event_delete_failed error_code=%s", code)
        return response(500, {"message": "Unable to delete training event"})

    logger.info("training_event_deleted event_id=%s", event_id)
    return response(204, {})


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Dispatch API Gateway proxy requests."""
    method = event.get("httpMethod")
    resource = event.get("resource")

    if method == "GET" and resource == "/events/{eventId}":
        return get_event(event)
    if method == "GET" and resource == "/events":
        return list_events(event)
    if method == "POST" and resource == "/events":
        return create_event(event)
    if method == "PUT" and resource == "/events/{eventId}":
        return update_event(event)
    if method == "DELETE" and resource == "/events/{eventId}":
        return delete_event(event)
    return response(404, {"message": "Route not found"})
PY

(cd "$BUILD_DIR" && python3 -m zipfile -c function.zip lambda_function.py)

log "Lambda function: $LAMBDA_FUNCTION_NAME ($RUNTIME)"
if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" >/dev/null 2>&1; then
    echo "Function already exists; updating code and configuration."
    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --zip-file "fileb://$BUILD_DIR/function.zip" >/dev/null
    aws lambda wait function-updated-v2 --function-name "$LAMBDA_FUNCTION_NAME"
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --environment "Variables={TABLE_NAME=$TABLE_NAME}" >/dev/null
    aws lambda wait function-updated-v2 --function-name "$LAMBDA_FUNCTION_NAME"
else
    aws lambda create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --runtime "$RUNTIME" \
        --role "$ROLE_ARN" \
        --handler lambda_function.lambda_handler \
        --timeout 10 \
        --memory-size 128 \
        --environment "Variables={TABLE_NAME=$TABLE_NAME}" \
        --zip-file "fileb://$BUILD_DIR/function.zip" >/dev/null
    aws lambda wait function-active-v2 --function-name "$LAMBDA_FUNCTION_NAME"
fi
LAMBDA_ARN="$(aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" \
    --query Configuration.FunctionArn --output text)"

# ---------------------------------------------------------------------------
# API Gateway (REST API, Lambda proxy integration, no authorizer yet)
# ---------------------------------------------------------------------------
log "API Gateway REST API: $API_NAME"
API_ID="$(aws apigateway get-rest-apis \
    --query "items[?name=='${API_NAME}'].id | [0]" --output text)"
if [[ "$API_ID" == "None" || -z "$API_ID" ]]; then
    API_ID="$(aws apigateway create-rest-api \
        --name "$API_NAME" \
        --endpoint-configuration types=REGIONAL \
        --query id --output text)"
else
    echo "API already exists; reusing it."
fi

resource_id() {
    aws apigateway get-resources --rest-api-id "$API_ID" \
        --query "items[?path=='$1'].id | [0]" --output text
}

ensure_resource() {
    local parent_id="$1" path_part="$2" full_path="$3" id
    id="$(resource_id "$full_path")"
    if [[ "$id" == "None" || -z "$id" ]]; then
        id="$(aws apigateway create-resource --rest-api-id "$API_ID" \
            --parent-id "$parent_id" --path-part "$path_part" \
            --query id --output text)"
    fi
    echo "$id"
}

INTEGRATION_URI="arn:aws:apigateway:${AWS_DEFAULT_REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations"

ensure_method() {
    local res_id="$1" method="$2"
    if ! aws apigateway get-method --rest-api-id "$API_ID" \
        --resource-id "$res_id" --http-method "$method" >/dev/null 2>&1; then
        aws apigateway put-method --rest-api-id "$API_ID" \
            --resource-id "$res_id" --http-method "$method" \
            --authorization-type NONE >/dev/null
    fi
    aws apigateway put-integration --rest-api-id "$API_ID" \
        --resource-id "$res_id" --http-method "$method" \
        --type AWS_PROXY --integration-http-method POST \
        --uri "$INTEGRATION_URI" >/dev/null
    echo "  $method configured"
}

ROOT_ID="$(resource_id "/")"
EVENTS_ID="$(ensure_resource "$ROOT_ID" "events" "/events")"
EVENT_ID_RES="$(ensure_resource "$EVENTS_ID" "{eventId}" "/events/{eventId}")"

echo "/events"
ensure_method "$EVENTS_ID" GET
ensure_method "$EVENTS_ID" POST
echo "/events/{eventId}"
ensure_method "$EVENT_ID_RES" GET
ensure_method "$EVENT_ID_RES" PUT
ensure_method "$EVENT_ID_RES" DELETE

log "Allowing API Gateway to invoke the Lambda function"
STATEMENT_ID="apigateway-${API_ID}"
aws lambda remove-permission --function-name "$LAMBDA_FUNCTION_NAME" \
    --statement-id "$STATEMENT_ID" >/dev/null 2>&1 || true
aws lambda add-permission \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --statement-id "$STATEMENT_ID" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_DEFAULT_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/*" >/dev/null

log "Deploying to stage: $STAGE_NAME"
aws apigateway create-deployment --rest-api-id "$API_ID" \
    --stage-name "$STAGE_NAME" \
    --description "Lab 4 starter deployment" >/dev/null

API_URL="https://${API_ID}.execute-api.${AWS_DEFAULT_REGION}.amazonaws.com/${STAGE_NAME}"

# ---------------------------------------------------------------------------
# Smoke test and environment file
# ---------------------------------------------------------------------------
log "Smoke test: GET /events/TRN001"
status=""
for _ in 1 2 3 4 5; do
    status="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/events/TRN001" || true)"
    [[ "$status" == "200" ]] && break
    sleep 3
done
echo "HTTP status: $status"

cat > "$ENV_FILE" <<EOF
export AWS_DEFAULT_REGION="$AWS_DEFAULT_REGION"
export TABLE_NAME="$TABLE_NAME"
export LAMBDA_FUNCTION_NAME="$LAMBDA_FUNCTION_NAME"
export API_ID="$API_ID"
export API_URL="$API_URL"
EOF

log "Lab 4 starter environment ready"
cat "$ENV_FILE"
echo
echo "Load these values in a new shell with:  source $ENV_FILE"
echo "Remove these resources to redo the lab with:  bash teardown-lab4.sh $ENV_FILE"
if [[ "$status" != "200" ]]; then
    echo "Smoke test did not return 200. Wait a minute and retry: curl -i \"\$API_URL/events/TRN001\"" >&2
fi
