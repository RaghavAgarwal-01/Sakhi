import os

import boto3

dynamodb = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT_URL") or None)
table = dynamodb.Table(os.environ.get("TABLE_NAME", "Sakhi_Records"))
connect_client = boto3.client("connect")

MOCK_VOICE_CALL = os.environ.get("MOCK_VOICE_CALL", "false").lower() == "true"

CONNECT_INSTANCE_ID = os.environ.get("CONNECT_INSTANCE_ID")
CONNECT_CONTACT_FLOW_ID = os.environ.get("CONNECT_CONTACT_FLOW_ID")
CONNECT_SOURCE_PHONE_NUMBER = os.environ.get("CONNECT_SOURCE_PHONE_NUMBER")


def handler(event, context):
    """
    Severe-stage parallel branch (b): automated outbound voice call to
    the family via Amazon Connect's StartOutboundVoiceContact.

    Falls back to a mocked print when MOCK_VOICE_CALL=true (the
    default) or when the Connect instance/flow/number env vars aren't
    all set — so this stays safe to deploy before the Connect instance
    exists. Flip MOCK_VOICE_CALL=false and fill in CONNECT_INSTANCE_ID,
    CONNECT_CONTACT_FLOW_ID, and CONNECT_SOURCE_PHONE_NUMBER once:
      1. An Amazon Connect instance exists with a claimed phone number.
      2. connect/sakhi_voice_alert_flow.json has been imported as a
         contact flow in that instance (Contact flows > Create flow >
         Import (from the "..." menu) > Save > Publish).
    """
    incident_id = event.get("incidentId")
    if not incident_id:
        return {"success": False, "message": "Missing incidentId"}

    incident = _get_incident(incident_id)
    if not incident:
        return {"success": False, "message": f"No incident found for id {incident_id}"}

    user = _get_user(incident.get("userId"))
    if not user:
        return {"success": False, "message": f"No user found for incident {incident_id}"}

    contacts = user.get("emergencyContacts") or []
    if not contacts:
        print(f"[Sakhi_TriggerVoiceCall] WARNING: no emergencyContacts for user {user.get('userId')}")
        return {"success": False, "message": "No emergency contacts to call"}

    attributes = _build_attributes(user, incident)
    results = [_place_call(contact, attributes, incident_id) for contact in contacts]

    return {"success": all(r["success"] for r in results), "incidentId": incident_id, "calls": results}


def _get_incident(incident_id):
    resp = table.get_item(Key={"PK": f"INCIDENT#{incident_id}", "SK": "METADATA"})
    return resp.get("Item")


def _get_user(user_id):
    if not user_id:
        return None
    resp = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
    return resp.get("Item")


def _build_attributes(user, incident):
    location = incident.get("currentLocation") or {}
    lat, lon = location.get("lat"), location.get("lon")
    maps_url = f"https://maps.google.com/?q={lat},{lon}" if lat and lon else "location unavailable"
    # Amazon Connect contact attributes must be strings.
    return {"VictimName": str(user.get("name", "Unknown")), "MapsUrl": maps_url}


def _connect_configured():
    return bool(CONNECT_INSTANCE_ID and CONNECT_CONTACT_FLOW_ID and CONNECT_SOURCE_PHONE_NUMBER)


def _place_call(contact, attributes, incident_id):
    phone = _normalize_phone(contact.get("phoneNumber"))
    if not phone:
        return {"success": False, "mocked": False, "phoneNumber": contact.get("phoneNumber"), "error": "Invalid phone number; use E.164 format"}

    if MOCK_VOICE_CALL:
        print(f"[MOCK VOICE CALL] Would call {phone} for incident {incident_id} with attributes {attributes}")
        return {"success": True, "mocked": True, "phoneNumber": phone}

    if not _connect_configured():
        return {
            "success": False,
            "mocked": False,
            "phoneNumber": phone,
            "error": "Amazon Connect is not configured (instance, contact flow, source phone are required)",
        }

    try:
        connect_client.start_outbound_voice_contact(
            DestinationPhoneNumber=phone,
            ContactFlowId=CONNECT_CONTACT_FLOW_ID,
            InstanceId=CONNECT_INSTANCE_ID,
            SourcePhoneNumber=CONNECT_SOURCE_PHONE_NUMBER,
            Attributes=attributes,
        )
        return {"success": True, "mocked": False, "phoneNumber": phone}
    except Exception as exc:  # noqa: BLE001 - keep state-machine branch observable
        print(f"[Sakhi_TriggerVoiceCall] Connect call failed for {phone}: {exc}")
        return {"success": False, "mocked": False, "phoneNumber": phone, "error": str(exc)}


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
