# Lambda function for the YMB Training Events API
# Version 04

from __future__ import annotations
import os
import boto3
import json
import logging
from typing import Any
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


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Dispatch GET and POST requests."""
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
    return response(404, {"message": "Route not found"})
