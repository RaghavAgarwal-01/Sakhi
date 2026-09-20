import json
import os

import boto3

from sakhi_http import response

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))


def handler(event, context):
    """
    GET /incidents/:id/status

    Reads INCIDENT#<id> / METADATA and returns the fields the mobile
    app / dashboard need to render current state. Read-only — never
    mutates status; that belongs to Sakhi_SendNotification / the
    Step Functions state machine (Day 2).
    """
    path_params = event.get("pathParameters") or {}
    incident_id = path_params.get("id")

    if not incident_id:
        return _response(400, {"error": "Missing incident id in path"})

    key = {"PK": f"INCIDENT#{incident_id}", "SK": "METADATA"}

    try:
        result = table.get_item(Key=key)
    except Exception as exc:  # noqa: BLE001 - hackathon speed, tighten later
        print(f"[Sakhi_CheckIncidentStatus] DynamoDB error: {exc}")
        return _response(500, {"error": "Failed to read incident"})

    item = result.get("Item")
    if not item:
        return _response(404, {"error": f"No incident found for id {incident_id}"})

    body = {
        "incidentId": incident_id,
        "userId": item.get("userId"),
        "status": item.get("status"),
        "triggerType": item.get("triggerType"),
        "timestamp": item.get("timestamp"),
        "currentLocation": item.get("currentLocation"),
        "cancellationTime": item.get("cancellationTime"),
    }
    return _response(200, body)


def _response(status_code, body):
    return response(status_code, body)
