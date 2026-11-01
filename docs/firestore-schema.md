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
| `ballsPerOver` | integer, 1-12 | Delivery count per over; defaults to 6 |
| `powerplayOvers` | integer, 0-overs per innings | Powerplay length; 0 disables the powerplay |
| `startDate` | `YYYY-MM-DD` string | Tournament start date |
| `endDate` | optional `YYYY-MM-DD` string | Tournament end date; cannot precede the start date |
| `venue` | string, 1-100 characters | Primary venue |
| `registrationOpen` | boolean | Whether team registration is open |
| `createdAt`, `updatedAt` | Firestore timestamps | Server timestamps; updates must preserve `createdAt` |

The Firestore rules allow public reads, require an authenticated owner for writes, prevent owner reassignment, and reject extra fields. The web client must write `createdAt` and `updatedAt` as `serverTimestamp()` values.

## Public and private team data

`tournaments/{tournamentId}/teams/{teamId}` is public and contains only `name`, `shortName`, `status: APPROVED`, and timestamps. Player records live at `teams/{teamId}/players/{playerId}` and contain only name, jersey number, and role. Only the tournament owner can create or change approved teams and players.

Captain names and contact details live in `tournaments/{tournamentId}/privateRegistrations/{teamId}`. Only the tournament owner can read or write these records, and the rule requires a corresponding public team. The organizer client creates the public team and private captain record in one batch; `existsAfter` lets the private write verify the team created by that same batch. Pending public submissions are not enabled yet; they need a separate bounded submission path and approval flow. Firestore does not filter fields from a readable document, so contact details must never be stored beside public team or player data.

## Knockout fixture document

`tournaments/{tournamentId}/fixtures/knockout` stores the generated rounds, team entries, and winner-of-match placeholders. It is public-readable and organizer-created; create-only client behavior prevents a second generation from silently replacing the first bracket. Replacing or editing a saved bracket needs an explicit organizer workflow.
