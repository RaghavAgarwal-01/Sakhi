import json
import os

import boto3
from botocore.exceptions import ClientError

from sakhi_http import parse_body, response

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))


def handler(event, context):
    """
    POST /incidents/:id/location

    Live location updates while an incident is in progress (mild
    window, post-severe tracking, or a manual incident). Overwrites
    currentLocation on the incident record only — it does not touch
    status and does not re-trigger any notifications itself.

    Expected request body:
        { "currentLocation": {"lat": <float>, "lon": <float>} }
    """
    path_params = event.get("pathParameters") or {}
    incident_id = path_params.get("id")

    if not incident_id:
        return _response(400, {"error": "Missing incident id in path"})

    try:
        body = parse_body(event)
    except (TypeError, ValueError):
        return _response(400, {"error": "Invalid JSON body"})

    location = body.get("currentLocation")
    if not location or "lat" not in location or "lon" not in location:
        return _response(400, {"error": "Missing currentLocation.lat/lon"})

    try:
        table.update_item(
            Key={"PK": f"INCIDENT#{incident_id}", "SK": "METADATA"},
            UpdateExpression="SET currentLocation = :loc",
            ConditionExpression="attribute_exists(PK)",
            ExpressionAttributeValues={":loc": location},
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _response(404, {"error": f"No incident found for id {incident_id}"})
        print(f"[Sakhi_UpdateLocation] DynamoDB error: {exc}")
        return _response(500, {"error": "Failed to update location"})
    except Exception as exc:
        print(f"[Sakhi_UpdateLocation] DynamoDB error: {exc}")
        return _response(503, {"error": "Incident store is unavailable"})

    return _response(200, {"incidentId": incident_id, "currentLocation": location})


def _response(status_code, body):
    return response(status_code, body)
