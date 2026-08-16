# Load-bearing flows

## Temporary inquiry

- Actor: local user.
- Precondition: none.
- Flow: browser input → temporary conversation state → optional model call through Harness.
- Data rule: no object ID, no localStorage write, no long-term memory call.
- Deny case: temporary message must not be recalled after refresh or object switching.

## Object-specific decision loop

- Actor: local user with an active object profile.
- Flow: input → current object ID scope → reference routing → Agent response → proposed action → explicit user confirmation → optional task record.
- Data rule: all messages, memories, evidence and tasks use the current object ID as partition key.
- Deny case: a write or recall whose subject does not match the current object is rejected.
- Side effect: only the local task/operation state changes; no message is sent to another person.

## Evidence import and identity mapping

- Actor: user who explicitly supplies or authorizes evidence.
- Flow: evidence metadata → sender/member ID check → optional anchor confirmation → locked mapping → observable event → source-linked candle.
- Trust crossing: user-controlled evidence enters local processing.
- Deny case: conflicting role for a locked sender ID pauses the batch and preserves the existing mapping.

## Model connection

- Actor: local user.
- Flow: compact “模型连接” entry → official Harness model settings → provider/API Key configuration.
- Trust crossing: browser → Harness provider → external model API.
- Data rule: the competition plugin does not read, print or commit the Key.
- Deny case: without a Key, public synthetic Demo remains available; live model calls fail without leaking configuration.

## Archive and restore

- Actor: local user.
- Flow: archive confirmation → object moved out of active list → stable ID and scoped data retained → optional restore.
- Deny case: restoring when five active objects already exist is refused.
