import json
from decimal import Decimal
import os

import boto3
from boto3.dynamodb.types import TypeDeserializer
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
records_table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))
connections_table = dynamodb.Table(os.environ.get("CONNECTIONS_TABLE", "Sakhi_Connections"))

WEBSOCKET_ENDPOINT = os.environ.get("WEBSOCKET_ENDPOINT")  # https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
apigw_management = (
    boto3.client("apigatewaymanagementapi", endpoint_url=WEBSOCKET_ENDPOINT)
    if WEBSOCKET_ENDPOINT
    else None
)

deserializer = TypeDeserializer()


def handler(event, context):
    """
    DynamoDB Streams trigger on Sakhi_Records.

    The EventSourceMapping's FilterCriteria already narrows invocations
    down to records whose NEW image has status == SEVERE_ACTIVE, so
    most table writes never reach this function at all. This is the
    ONLY place that pushes the full victim dossier to the
    police/helpline dashboard — it must never fire for the mild stage,
    and the old-image check below stops it firing twice for the same
    incident.
    """
    for record in event.get("Records", []):
        if record.get("eventName") not in ("INSERT", "MODIFY"):
            continue

        new_image = record.get("dynamodb", {}).get("NewImage")
        old_image = record.get("dynamodb", {}).get("OldImage") or {}
        if not new_image:
            continue

        item = {k: deserializer.deserialize(v) for k, v in new_image.items()}
        old_item = {k: deserializer.deserialize(v) for k, v in old_image.items()}

        if item.get("SK") != "METADATA":
            continue
        if item.get("status") != "SEVERE_ACTIVE":
            continue
        if old_item.get("status") == "SEVERE_ACTIVE":
            continue  # already dispatched once for this incident

        _dispatch(item)


def _dispatch(incident):
    user = _get_user(incident.get("userId"))
    if not user:
        print(f"[Sakhi_DispatchOnSevereIncident] No user found for incident {incident.get('PK')}")
        return

    payload = {
        "type": "ACTIVE_EMERGENCY_DISPATCH",
        "incidentId": incident["PK"].replace("INCIDENT#", ""),
        "victim": {
            "name": user.get("name"),
            "age": user.get("age"),
            "phoneNumber": user.get("phoneNumber"),
            "address": user.get("address"),
            "photoUrl": user.get("photoUrl"),
        },
        "currentLocation": incident.get("currentLocation"),
    }
    _broadcast(payload)


def _get_user(user_id):
    if not user_id:
        return None
    resp = records_table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
    return resp.get("Item")

def _decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")
def _broadcast(payload):
    if not apigw_management:
        print(f"[MOCK WEBSOCKET PUSH] {payload}")
        return

    message = json.dumps(payload, default=_decimal_default).encode("utf-8")
    connections = connections_table.scan().get("Items", [])

    for conn in connections:
        connection_id = conn["connectionId"]
        try:
            apigw_management.post_to_connection(ConnectionId=connection_id, Data=message)
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "GoneException":
                connections_table.delete_item(Key={"connectionId": connection_id})
            else:
                print(f"[Sakhi_DispatchOnSevereIncident] postToConnection failed for {connection_id}: {exc}")
