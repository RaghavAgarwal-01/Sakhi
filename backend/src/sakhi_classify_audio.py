import json
import os

MOCK_CLASSIFIER = os.environ.get("MOCK_CLASSIFIER", "true").lower() == "true"


def handler(event, context):
    """
    POST /classify

    Second-opinion check after the mobile app's on-device model thinks
    it heard a scream or codeword during continuous background
    listening. Not the primary detector — that runs on-device via
    inferencePreference — this exists to cut false positives before an
    incident actually fires.

    Mocked for now so the mobile team can integrate against a stable
    contract immediately. Swap the body of this function for real
    inference once a model exists — a feature-engineered gradient
    boosting model (e.g. LightGBM over MFCCs) would fit comfortably in
    a plain Lambda without extra layers or a container image, if
    that's the direction the model takes.

    Expected request body:
        {
          "userId": "<id>",
          "audioBase64": "<base64-encoded short audio clip>",
          "audioFormat": "wav"
        }
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except (TypeError, ValueError):
        return _response(400, {"error": "Invalid JSON body"})

    audio_b64 = body.get("audioBase64")
    if not audio_b64:
        return _response(400, {"error": "Missing audioBase64"})

    if MOCK_CLASSIFIER:
        classification = "NORMAL"
        confidence = 0.5
        print(f"[MOCK CLASSIFIER] Received {len(audio_b64)} base64 chars for user {body.get('userId')}, returning {classification}")
        return _response(200, {"classification": classification, "confidence": confidence})

    # TODO: real model inference goes here once the model is ready.
    raise NotImplementedError("Real classifier not yet wired up")


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
