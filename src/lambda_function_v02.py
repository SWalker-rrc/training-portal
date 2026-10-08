# Lambda function for the YMB Training Events API
# Version 02

from __future__ import annotations
import os
import boto3
import json
import logging
from typing import Any

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


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Dispatch the current API route."""
    if (
        event.get("httpMethod") == "GET"
        and event.get("resource") == "/events/{eventId}"
    ):
        return get_event(event)
    if event.get("httpMethod") == "GET" and event.get("resource") == "/events":
        return list_events(event)
    return response(404, {"message": "Route not found"})
