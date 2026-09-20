import json
import os
import time
import uuid

import boto3

from sakhi_http import parse_body, response

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))
sfn = boto3.client("stepfunctions")

STATE_MACHINE_ARN = os.environ.get("STATE_MACHINE_ARN")
VALID_TRIGGER_TYPES = {"SCREAM_DETECTED", "CODEWORD"}


def handler(event, context):
    """
    POST /incidents

    SCREAM_DETECTED / CODEWORD only — this is the entry point into the
    2-stage escalation state machine. Manual triggers use
    POST /incidents/manual instead and must never reach this function.

    Expected request body:
        {
          "userId": "<id>",
          "triggerType": "SCREAM_DETECTED" | "CODEWORD",
          "currentLocation": {"lat": <float>, "lon": <float>},
          "audioSnippetUrl": "..."   # optional
        }
    """
    try:
        body = parse_body(event)
    except (TypeError, ValueError):
        return _response(400, {"error": "Invalid JSON body"})

    user_id = body.get("userId")
    trigger_type = body.get("triggerType")
    location = body.get("currentLocation") or {}

    if not user_id:
        return _response(400, {"error": "Missing userId"})
    if trigger_type not in VALID_TRIGGER_TYPES:
        return _response(
            400,
            {
                "error": (
                    f"triggerType must be one of {sorted(VALID_TRIGGER_TYPES)}. "
                    "Use /incidents/manual for manual triggers."
                )
            },
        )

    try:
        user = _get_user(user_id)
    except Exception as exc:
        print(f"[Sakhi_CreateIncident] DynamoDB error while reading user: {exc}")
        return _response(503, {"error": "Incident store is unavailable"})
    if not user:
        return _response(404, {"error": f"No user found for id {user_id}"})

    incident_id = str(uuid.uuid4())
    timestamp = int(time.time())

    try:
        table.put_item(Item={
            "PK": f"INCIDENT#{incident_id}", "SK": "METADATA", "userId": user_id,
            "status": "PENDING", "triggerType": trigger_type, "timestamp": timestamp,
            "currentLocation": location, "audioSnippetUrl": body.get("audioSnippetUrl"),
        })
    except Exception as exc:
        print(f"[Sakhi_CreateIncident] DynamoDB error while creating incident: {exc}")
        return _response(503, {"error": "Incident store is unavailable"})

    try:
        sfn.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            name=f"sakhi-{incident_id}",
            input=json.dumps({"incidentId": incident_id}),
        )
    except Exception as exc:  # noqa: BLE001 - hackathon speed, tighten later
        print(f"[Sakhi_CreateIncident] Failed to start escalation for {incident_id}: {exc}")
        return _response(500, {"error": "Incident recorded but escalation failed to start"})

    return _response(201, {"incidentId": incident_id, "status": "PENDING", "triggerType": trigger_type})


def _get_user(user_id):
    resp = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
    return resp.get("Item")


def _response(status_code, body):
    return response(status_code, body)
