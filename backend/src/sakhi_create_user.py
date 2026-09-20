import json
import os
import uuid

import boto3

from sakhi_http import parse_body, response

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))


def handler(event, context):
    """
    POST /users

    Creates a USER#<userId>/PROFILE record. Called once during mobile
    app onboarding, before any incident can be raised for that user.

    Expected request body:
        {
          "name": "...",
          "age": <int>,
          "phoneNumber": "...",
          "address": "...",
          "photoUrl": "...",
          "customCodeword": "...",
          "inferencePreference": "...",
          "emergencyContacts": [
            {"name": "...", "phoneNumber": "...", "relation": "..."}
          ]
        }
    """
    try:
        body = parse_body(event)
    except (TypeError, ValueError):
        return _response(400, {"error": "Invalid JSON body"})

    required = ["name", "phoneNumber", "emergencyContacts"]
    missing = [field for field in required if not body.get(field)]
    if missing:
        return _response(400, {"error": f"Missing required field(s): {', '.join(missing)}"})

    user_id = str(uuid.uuid4())

    try:
        table.put_item(
            Item={
                "PK": f"USER#{user_id}", "SK": "PROFILE", "name": body["name"],
                "age": body.get("age"), "phoneNumber": body["phoneNumber"],
                "address": body.get("address"), "photoUrl": body.get("photoUrl"),
                "customCodeword": body.get("customCodeword"),
                "inferencePreference": body.get("inferencePreference"),
                "emergencyContacts": body["emergencyContacts"],
            }
        )
    except Exception as exc:  # DynamoDB must not turn into an API Gateway 502.
        print(f"[Sakhi_CreateUser] DynamoDB error: {exc}")
        return _response(503, {"error": "User store is unavailable"})

    return _response(201, {"userId": user_id})


def _response(status_code, body):
    return response(status_code, body)
