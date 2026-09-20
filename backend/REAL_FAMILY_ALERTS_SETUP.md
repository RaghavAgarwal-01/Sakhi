# Sakhi — real family SMS + voice escalation

The existing Step Functions state machine already fans out the severe stage into three parallel branches:

1. Family SMS via `Sakhi_SendNotification`
2. Family voice call via `Sakhi_TriggerVoiceCall`
3. `SEVERE_ACTIVE` update, which drives the dashboard WebSocket dispatch

This package removes the hard-coded mock behavior from the deployment configuration and adds the AWS/India configuration values required for real delivery. The live providers are still dependent on the AWS console setup described below.

## 1. SMS — Amazon SNS

AWS accounts using SNS SMS begin in the SMS sandbox. While in the sandbox, every destination phone number must be verified; up to 10 destination numbers can be verified.

For India local SMS routes, AWS requires a registered sender ID plus the TRAI/DLT Entity ID and Template ID, and the message must match the registered template exactly. The Sakhi code therefore uses separate Template ID parameters for MILD, SEVERE, ALL_CLEAR, and MANUAL messages.

### Fastest hackathon path

For a small demo, you can first keep the Sender ID / Entity ID / Template IDs blank and use the default international route. AWS documents that India recipients can be reached over international (ILDO) routes without DLT sender-ID registration; the tradeoff is a generic sender and higher cost. Because new SNS SMS accounts start in the SMS sandbox, the family numbers still need to be verified.

In the AWS console (region `ap-south-1`):

- Open Amazon SNS / AWS End User Messaging SMS.
- Verify each family destination number in the SMS sandbox, or request production access if you need to message unverified numbers.
- For the fastest test, leave the Sender ID and DLT parameters blank.
- For a branded India local route later, register/activate the `SAKHI` transactional sender ID and the exact Sakhi SMS templates, then put the resulting DLT IDs into the SAM deployment parameters.

The family contact numbers stored in `emergencyContacts[].phoneNumber` may be `9876543210`, `091234567890`, `919876543210`, or `+919876543210`; the Lambda normalizes Indian numbers to E.164 before calling SNS/Connect.

## 2. Amazon Connect — family voice call

Create an Amazon Connect instance in the same AWS account/region used by the deployment. Claim or configure a phone number that can be used as the source/caller ID.

Import `connect/sakhi_voice_alert_flow.json` into the Connect instance:

`Contact flows → Create flow → Import`

Then Save and Publish the flow. Obtain:

- Connect Instance ID
- Published Contact Flow ID
- Claimed Connect source phone number in E.164 format

The Lambda calls `StartOutboundVoiceContact` with the emergency contact as `DestinationPhoneNumber`, the published flow as `ContactFlowId`, the Connect instance ID, and the claimed source phone number.

## 3. Deploy

Edit `samconfig.toml` and replace the placeholders:

- `REPLACE_CONNECT_INSTANCE_ID`
- `REPLACE_CONTACT_FLOW_ID`
- `REPLACE_CONNECT_SOURCE_PHONE_E164`
- For the quick international-route sandbox test, no DLT values are required.
- For the India local route, replace the blank `SmsEntityId` and action-specific template IDs with the approved values.

Then from the `backend` directory run:

```bash
sam build
sam deploy
```

The deployment keeps the two live flags explicit:

```text
MockSns=false
MockVoiceCall=false
```

## 4. End-to-end test

Create a test user with one family member in `emergencyContacts`. Use that family member's verified phone number. Trigger a `SCREAM_DETECTED` or `CODEWORD` incident.

Expected behavior:

- T=0: mobile app shows its existing 60-second warning; real MILD SMS is sent to family.
- T=60, unless cancelled: SEVERE SMS is sent to family; Amazon Connect starts the outbound voice call; DynamoDB is updated to `SEVERE_ACTIVE`; the dashboard receives `ACTIVE_EMERGENCY_DISPATCH`.
- On cancellation: the state machine sends the ALL_CLEAR family SMS.

## 5. Where to debug

Check these CloudWatch log groups/functions:

- `/aws/lambda/Sakhi_SendNotification`
- `/aws/lambda/Sakhi_TriggerVoiceCall`
- `/aws/lambda/Sakhi_DispatchOnSevereIncident`

Useful log messages now include the SNS MessageId, per-contact delivery result, and Connect error details.

## 6. Credentials hygiene

Do not commit AWS access-key CSVs, `.env` files, private keys, or `.aws-sam/` build artifacts. The original uploaded package contained access-key CSVs; they were removed from this cleaned package and `.gitignore` now excludes them. If those keys were ever real, rotate/delete them before using the account for the hackathon.
