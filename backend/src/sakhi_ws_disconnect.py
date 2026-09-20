import os

import boto3

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
connections_table = dynamodb.Table(os.environ.get("CONNECTIONS_TABLE", "Sakhi_Connections"))


def handler(event, context):
    """
    WebSocket $disconnect route. Removes the connectionId so
    Sakhi_DispatchOnSevereIncident stops trying to push to a dashboard
    tab that's gone.
    """
    connection_id = event["requestContext"]["connectionId"]
    connections_table.delete_item(Key={"connectionId": connection_id})
    return {"statusCode": 200}
