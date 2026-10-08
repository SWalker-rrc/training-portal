# Lambda function for the YMB Training Events API
# Version 01
# This is a simplified example to demonstrate how to use AWS Lambda with API Gateway and DynamoDB.
# It is not production-ready code.

import os
import boto3
import json

db = boto3.resource("dynamodb")
table = db.Table(os.environ["TABLE_NAME"])


def response(status_code, body):
    """Helper to format API Gateway responses."""
    return {"statusCode": status_code, "body": json.dumps(body)}


def lambda_handler(event, context):
    """Dispatch the current API route."""
    event_id = event.get("pathParameters", {}).get("eventId")
    item = table.get_item(Key={"eventId": event_id}).get("Item")

    if item is None:
        return response(404, {"message": "Training event not found"})

    return response(200, item)
