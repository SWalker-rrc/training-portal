# Lambda function for the YMB Training Events API
# Version 06

from __future__ import annotations
import os
import boto3
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key


db = boto3.resource("dynamodb")
table = db.Table(os.environ["TABLE_NAME"])
registrations_table = db.Table(os.environ["REGISTRATIONS_TABLE_NAME"])

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def user_id_from_event(event: dict) -> str | None:
    """Read the verified Cognito subject claim; never trust a client-supplied userId."""
    authorizer = (event.get("requestContext") or {}).get("authorizer") or {}
    claims = authorizer.get("claims") or {}
    sub = claims.get("sub")
    return sub if isinstance(sub, str) and sub.strip() else None


def create_registration(event: dict) -> dict:
    """Register the authenticated caller for one training event."""
    user_id = user_id_from_event(event)
    payload = json_body(event)
    if user_id is None:
        return response(401, {"message": "A valid signed-in user is required"})
    if payload is None:
        return response(400, {"message": "Request body must be a JSON object"})
    if "userId" in payload:
        return response(400, {"message": "userId comes from the verified sign-in"})

    event_id = payload.get("eventId")
    if not isinstance(event_id, str) or not event_id.strip():
        return response(400, {"message": "eventId is required"})

    item = {
        "userId": user_id,
        "eventId": event_id.strip(),
        "registrationId": str(uuid4()),
        "registrationStatus": "REGISTERED",
        "registeredAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        registrations_table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(eventId)",
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "Unknown")
        if code == "ConditionalCheckFailedException":
            return response(409, {"message": "Already registered for this event"})
        logger.exception("registration_create_failed error_code=%s", code)
        return response(500, {"message": "Unable to create registration"})

    return response(201, item)


def list_my_registrations(event: dict) -> dict:
    """Return only the authenticated caller's registrations."""
    user_id = user_id_from_event(event)
    if user_id is None:
        return response(401, {"message": "A valid signed-in user is required"})

    items = registrations_table.query(
        KeyConditionExpression=Key("userId").eq(user_id)
    ).get("Items", [])
    return response(200, {"registrations": items})


def get_my_registration(event: dict) -> dict:
    """Return one registration, but only if it belongs to the caller."""
    user_id = user_id_from_event(event)
    if user_id is None:
        return response(401, {"message": "A valid signed-in user is required"})

    event_id = event_id_from_path(event)
    if event_id is None:
        return response(400, {"message": "eventId is required"})

    item = registrations_table.get_item(
        Key={"userId": user_id, "eventId": event_id}
    ).get("Item")
    if item is None:
        return response(404, {"message": "Registration not found"})

    return response(200, item)


def response(status_code, body):
    """Helper to format API Gateway responses."""
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            "X-Requested-With": "*",
        },
        "body": json.dumps(body),
    }


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
    """Dispatch the request and log a safe summary of the outcome."""
    result = route_request(event)
    request_id = (event.get("requestContext") or {}).get("requestId", "unknown")
    # Never log the full event: it contains the Authorization header and request body.
    logger.info(
        "api_request_completed request_id=%s method=%s route=%s status_code=%s",
        request_id,
        event.get("httpMethod"),
        event.get("resource"),
        result["statusCode"],
    )
    return result


def route_request(event: dict[str, Any]) -> dict[str, Any]:
    """Dispatch the current API route."""
    if (
        event.get("httpMethod") == "GET"
        and event.get("resource") == "/events/{eventId}"
    ):
        return get_event(event)
    if event.get("httpMethod") == "GET" and event.get("resource") == "/events":
        return list_events(event)
    if event.get("httpMethod") == "POST" and event.get("resource") == "/events":
        return create_event(event)
    if (
        event.get("httpMethod") == "PUT"
        and event.get("resource") == "/events/{eventId}"
    ):
        return update_event(event)

    if (
        event.get("httpMethod") == "DELETE"
        and event.get("resource") == "/events/{eventId}"
    ):
        return delete_event(event)
    if event.get("httpMethod") == "POST" and event.get("resource") == "/registrations":
        return create_registration(event)

    if event.get("httpMethod") == "GET" and event.get("resource") == "/registrations":
        return list_my_registrations(event)
    if (
        event.get("httpMethod") == "GET"
        and event.get("resource") == "/registrations/{eventId}"
    ):
        return get_my_registration(event)

    return response(404, {"message": "Route not found"})
