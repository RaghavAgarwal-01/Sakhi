import json
import os
import time

import boto3
from botocore.exceptions import ClientError

from sakhi_http import parse_body, response

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))


def handler(event, context):
    """
    POST /incidents/:id/cancel

    Called by the mobile app after biometric auth, inside the
    60-second window. Sets status=CANCELLED, which the state
    machine's CheckCancellationStatus step reads at T=60 to route to
    the all-clear branch instead of the severe escalation.

    A conditional update refuses to cancel once the incident has
    already reached SEVERE_ACTIVE — cancellation only makes sense
    before the severe branch has fired.

    Expected request body:
        { "biometricVerified": true }
    """
    path_params = event.get("pathParameters") or {}
    incident_id = path_params.get("id")

    if not incident_id:
        return _response(400, {"error": "Missing incident id in path"})

    try:
        body = parse_body(event)
    except (TypeError, ValueError):
        return _response(400, {"error": "Invalid JSON body"})

    if not body.get("biometricVerified"):
        return _response(403, {"error": "Biometric verification required to cancel"})

    try:
        table.update_item(
            Key={"PK": f"INCIDENT#{incident_id}", "SK": "METADATA"},
            UpdateExpression="SET #status = :cancelled, cancellationTime = :time",
            ConditionExpression="attribute_exists(PK) AND #status <> :severe",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":cancelled": "CANCELLED",
                ":severe": "SEVERE_ACTIVE",
                ":time": int(time.time()),
            },
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _response(
                409,
                {"error": "Incident not found, or already escalated to the severe stage — cannot cancel"},
            )
        print(f"[Sakhi_CancelIncident] DynamoDB error: {exc}")
        return _response(500, {"error": "Failed to cancel incident"})
    except Exception as exc:
        print(f"[Sakhi_CancelIncident] DynamoDB error: {exc}")
        return _response(503, {"error": "Incident store is unavailable"})

    return _response(200, {"incidentId": incident_id, "status": "CANCELLED"})


def _response(status_code, body):
    return response(status_code, body)
