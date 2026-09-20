"""Small HTTP helpers shared by the API Lambda handlers."""

import json
from decimal import Decimal


def parse_body(event):
    """Decode an API Gateway JSON body using DynamoDB-compatible numbers."""
    return json.loads(event.get("body") or "{}", parse_float=Decimal)


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        # DynamoDB returns Decimal values; API responses should retain numbers.
        "body": json.dumps(body, default=_json_default),
    }


def _json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"{type(value).__name__} is not JSON serializable")
