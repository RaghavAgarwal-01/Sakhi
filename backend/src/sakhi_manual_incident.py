import json
import os
import time
import uuid

import boto3

from sakhi_http import parse_body, response

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))
sns = boto3.client("sns")

MOCK_SNS = os.environ.get("MOCK_SNS", "false").lower() == "true"
SMS_SENDER_ID = os.environ.get("SMS_SENDER_ID", "SAKHI")
SMS_ENTITY_ID = os.environ.get("SMS_ENTITY_ID", "")
SMS_MANUAL_TEMPLATE_ID = os.environ.get("SMS_MANUAL_TEMPLATE_ID", "")

# Not one of the three "exact copy" templates in the spec (mild/all-clear/
# severe) — manual triggers were never given fixed wording, so this is a
# reasonable default in the same voice. Edit freely.
MANUAL_MESSAGE_TEMPLATE = (
    "Sakhi Alert: {name} has manually triggered an emergency alert. "
    "Live location: {maps_url}. Please check on them immediately."
)


def handler(event, context):
    """
    POST /incidents/manual

    One-shot, family-only alert. Deliberately has NO Step Function, NO
    60-second timer, and NO police/helpline involvement — do not route
    this through Sakhi_SendNotification's MILD/SEVERE actions or the
    escalation state machine; that machinery is reserved for
    SCREAM_DETECTED / CODEWORD incidents only.

    Expected request body:
        {
          "userId": "<id>",
          "currentLocation": {"lat": <float>, "lon": <float>}
        }
    """
    try:
        body = parse_body(event)
    except (TypeError, ValueError):
        return _response(400, {"error": "Invalid JSON body"})

    user_id = body.get("userId")
    location = body.get("currentLocation") or {}

    if not user_id:
        return _response(400, {"error": "Missing userId"})

    try:
        user = _get_user(user_id)
    except Exception as exc:
        print(f"[Sakhi_ManualIncident] DynamoDB error while reading user: {exc}")
        return _response(503, {"error": "Incident store is unavailable"})
    if not user:
        return _response(404, {"error": f"No user found for id {user_id}"})

    incident_id = str(uuid.uuid4())
    timestamp = int(time.time())

    try:
        table.put_item(Item={
            "PK": f"INCIDENT#{incident_id}", "SK": "METADATA", "userId": user_id,
            "status": "SENT", "triggerType": "MANUAL", "timestamp": timestamp,
            "currentLocation": location,
        })
    except Exception as exc:
        print(f"[Sakhi_ManualIncident] DynamoDB error while creating incident: {exc}")
        return _response(503, {"error": "Incident store is unavailable"})

    message = _build_message(user, location)
    contacts = user.get("emergencyContacts") or []

    if not contacts:
        print(f"[Sakhi_ManualIncident] WARNING: no emergencyContacts for user {user_id}")

    deliveries = []
    for contact in contacts:
        deliveries.append({
            "phoneNumber": _normalize_phone(contact.get("phoneNumber")),
            "success": _send_sms(contact, message),
        })

    return _response(
        201,
        {
            "incidentId": incident_id,
            "status": "SENT",
            "triggerType": "MANUAL",
            "deliveries": deliveries,
        },
    )


def _get_user(user_id):
    resp = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
    return resp.get("Item")


def _build_message(user, location):
    name = user.get("name", "Unknown")
    lat, lon = location.get("lat"), location.get("lon")
    maps_url = f"https://maps.google.com/?q={lat},{lon}" if lat and lon else "location unavailable"
    return MANUAL_MESSAGE_TEMPLATE.format(name=name, maps_url=maps_url)


def _send_sms(contact, message):
    phone = _normalize_phone(contact.get("phoneNumber"))
    if not phone:
        print(f"[Sakhi_ManualIncident] Skipping contact with invalid phone number: {contact}")
        return False
    if MOCK_SNS:
        print(f"[MOCK SNS] To: {phone} | Message: {message}")
        return True
    message_attributes = {
        "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
    }
    if SMS_SENDER_ID:
        message_attributes["AWS.SNS.SMS.SenderID"] = {
            "DataType": "String", "StringValue": SMS_SENDER_ID
        }
    if SMS_ENTITY_ID:
        message_attributes["AWS.MM.SMS.EntityId"] = {
            "DataType": "String", "StringValue": SMS_ENTITY_ID
        }
    if SMS_MANUAL_TEMPLATE_ID:
        message_attributes["AWS.MM.SMS.TemplateId"] = {
            "DataType": "String", "StringValue": SMS_MANUAL_TEMPLATE_ID
        }
    try:
        result = sns.publish(PhoneNumber=phone, Message=message, MessageAttributes=message_attributes)
        print(f"[Sakhi_ManualIncident] SMS accepted by SNS for {phone}: {result.get('MessageId')}")
        return True
    except Exception as exc:  # noqa: BLE001 - hackathon speed
        print(f"[Sakhi_ManualIncident] SNS publish failed for {phone}: {exc}")
        return False


def _normalize_phone(phone):
    if not phone:
        return None
    phone = str(phone).strip().replace(" ", "").replace("-", "")
    if phone.startswith("+91") and len(phone) == 13 and phone[3:].isdigit():
        return phone
    if phone.startswith("91") and len(phone) == 12 and phone[2:].isdigit():
        return "+" + phone
    if phone.startswith("0") and len(phone) == 11 and phone[1:].isdigit():
        return "+91" + phone[1:]
    if len(phone) == 10 and phone.isdigit():
        return "+91" + phone
    return phone if phone.startswith("+") else None


def _response(status_code, body):
    return response(status_code, body)
