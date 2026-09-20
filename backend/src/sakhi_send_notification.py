import os

import boto3

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))
sns = boto3.client("sns")

MOCK_SNS = os.environ.get("MOCK_SNS", "false").lower() == "true"
SMS_SENDER_ID = os.environ.get("SMS_SENDER_ID", "SAKHI")
SMS_ENTITY_ID = os.environ.get("SMS_ENTITY_ID", "")
SMS_TEMPLATE_IDS = {
    "MILD": os.environ.get("SMS_MILD_TEMPLATE_ID", ""),
    "SEVERE": os.environ.get("SMS_SEVERE_TEMPLATE_ID", ""),
    "ALL_CLEAR": os.environ.get("SMS_ALL_CLEAR_TEMPLATE_ID", ""),
}

# Message copy must match exactly — do not reword.
MESSAGE_TEMPLATES = {
    "MILD": (
        "Sakhi Alert: A potential threat audio trigger was detected "
        "for {name}. They have 60 seconds to cancel it. Live location: "
        "{maps_url}. Stand by for updates."
    ),
    "ALL_CLEAR": (
        "Sakhi Update: {name} has marked themselves safe. This was a "
        "false alarm. No further action needed."
    ),
    "SEVERE": (
        "URGENT SAKHI SOS: {name} did not respond to the safety timer. "
        "This is an active emergency. Live tracking: {maps_url}."
    ),
}


def handler(event, context):
    """
    Sakhi_SendNotification — routes the FAMILY-only SMS leg by an
    `action` field on the event: MILD | SEVERE | ALL_CLEAR.

    Day 1 scope only. This function does NOT touch the severe-stage
    police/helpline WebSocket push or the Amazon Connect/Pinpoint voice
    call — those are separate parallel branches inside the Step
    Functions state machine (Day 2). Keep it that way: the severe
    stage fans out to three independent targets (family SMS, family
    call, police/helpline dashboard), and folding them into this one
    function would break that separation.

    Expected event shape:
        {
          "action": "MILD" | "SEVERE" | "ALL_CLEAR",
          "incidentId": "<id>"
        }
    """
    action = (event.get("action") or "").upper()
    incident_id = event.get("incidentId")

    if action not in MESSAGE_TEMPLATES:
        return _result(False, f"Unknown action '{action}'")
    if not incident_id:
        return _result(False, "Missing incidentId")

    incident = _get_incident(incident_id)
    if not incident:
        return _result(False, f"No incident found for id {incident_id}")

    user = _get_user(incident.get("userId"))
    if not user:
        return _result(False, f"No user found for incident {incident_id}")

    message = _build_message(action, user, incident)
    contacts = user.get("emergencyContacts") or []

    if not contacts:
        print(f"[Sakhi_SendNotification] WARNING: no emergencyContacts for user {user.get('userId')}")

    results = []
    for contact in contacts:
        results.append({
            "phoneNumber": _normalize_phone(contact.get("phoneNumber")),
            "success": _send_sms(contact, message, action),
        })

    success = bool(results) and all(result["success"] for result in results)
    return _result(
        success,
        f"{action} notification processed for incident {incident_id}",
        notification_body=message,
        deliveries=results,
    )


def _get_incident(incident_id):
    resp = table.get_item(Key={"PK": f"INCIDENT#{incident_id}", "SK": "METADATA"})
    return resp.get("Item")


def _get_user(user_id):
    if not user_id:
        return None
    resp = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
    return resp.get("Item")


def _build_message(action, user, incident):
    name = user.get("name", "Unknown")
    location = incident.get("currentLocation") or {}
    lat, lon = location.get("lat"), location.get("lon")
    maps_url = f"https://maps.google.com/?q={lat},{lon}" if lat and lon else "location unavailable"
    return MESSAGE_TEMPLATES[action].format(name=name, maps_url=maps_url)


def _send_sms(contact, message, action):
    phone = _normalize_phone(contact.get("phoneNumber"))
    if not phone:
        print(f"[Sakhi_SendNotification] Skipping contact with invalid phone number: {contact}")
        return False

    if MOCK_SNS:
        print(f"[MOCK SNS] To: {phone} | Message: {message}")
        return True

    message_attributes = {
        "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
    }
    if SMS_SENDER_ID:
        message_attributes["AWS.SNS.SMS.SenderID"] = {
            "DataType": "String",
            "StringValue": SMS_SENDER_ID,
        }
    # India local routes require the TRAI/DLT entity and template IDs.
    if SMS_ENTITY_ID:
        message_attributes["AWS.MM.SMS.EntityId"] = {
            "DataType": "String",
            "StringValue": SMS_ENTITY_ID,
        }
    template_id = SMS_TEMPLATE_IDS.get((action or "").upper())
    if template_id:
        message_attributes["AWS.MM.SMS.TemplateId"] = {
            "DataType": "String",
            "StringValue": template_id,
        }

    try:
        response = sns.publish(
            PhoneNumber=phone,
            Message=message,
            MessageAttributes=message_attributes,
        )
        print(f"[Sakhi_SendNotification] SMS accepted by SNS for {phone}: {response.get('MessageId')}")
        return True
    except Exception as exc:  # noqa: BLE001 - keep state-machine branch observable
        print(f"[Sakhi_SendNotification] SNS publish failed for {phone}: {exc}")
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


def _result(success, message, **extra):
    body = {"success": success, "message": message, **extra}
    print(f"[Sakhi_SendNotification] {body}")
    return body
