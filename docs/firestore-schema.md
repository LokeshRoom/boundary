# Firestore data contract

## Tournament document

`tournaments/{tournamentId}` is the public tournament summary and organizer-owned configuration document. Its initial allowed fields are:

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string, 1-60 characters | Public tournament name |
| `format` | `KNOCKOUT`, `LEAGUE`, or `GROUP_KNOCKOUT` | Fixture format |
| `status` | `REGISTRATION`, `UPCOMING`, `LIVE`, or `COMPLETED` | Tournament lifecycle |
| `organizerUid` | string | Firebase Auth UID that owns writes; visible in public reads |
| `oversPerInnings` | integer, 1-100 | Innings limit |
| `registrationOpen` | boolean | Whether team registration is open |
| `createdAt`, `updatedAt` | Firestore timestamps | Server timestamps; updates must preserve `createdAt` |

The Firestore rules allow public reads, require an authenticated owner for writes, prevent owner reassignment, and reject extra fields. The web client must write `createdAt` and `updatedAt` as `serverTimestamp()` values.

## Public and private team data

Public team records must not contain captain contact details. Keep captain contact data in a separate private registration document; `teams` and `privateRegistrations` are denied to all clients until their dedicated registration and approval rules are implemented. Firestore does not filter fields from a readable document, so storing contact data beside public team fields would expose it.
