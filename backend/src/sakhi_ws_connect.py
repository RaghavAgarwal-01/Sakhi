import os

import boto3

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
connections_table = dynamodb.Table(os.environ.get("CONNECTIONS_TABLE", "Sakhi_Connections"))


def handler(event, context):
    """
    WebSocket $connect route.

    Called once per police/helpline dashboard tab that opens a
    connection. Stores the connectionId so
    Sakhi_DispatchOnSevereIncident knows who to push
    ACTIVE_EMERGENCY_DISPATCH payloads to later.
    """
    connection_id = event["requestContext"]["connectionId"]
    connections_table.put_item(Item={"connectionId": connection_id})
    return {"statusCode": 200}
