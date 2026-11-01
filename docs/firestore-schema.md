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
| `teamCount` | integer, 0-1000 | Denormalized count of approved teams; incremented atomically with team creation |
| `createdAt`, `updatedAt` | Firestore timestamps | Server timestamps; updates must preserve `createdAt` |

The Firestore rules allow public reads, require an authenticated owner for writes, prevent owner reassignment, and reject extra fields. The web client must write `createdAt` and `updatedAt` as `serverTimestamp()` values.

## Public and private team data

`tournaments/{tournamentId}/teams/{teamId}` is public and contains only `name`, `shortName`, `status: APPROVED`, and timestamps. Player records live at `teams/{teamId}/players/{playerId}` and contain only name, jersey number, and role. Only the tournament owner can create or change approved teams and players.

Captain names and contact details live in `tournaments/{tournamentId}/privateRegistrations/{teamId}`. Only the tournament owner can read or write these records, and the rule requires a corresponding public team. The organizer client creates the public team and private captain record in one batch; `existsAfter` lets the private write verify the team created by that same batch. Firestore does not filter fields from a readable document, so contact details must never be stored beside public team or player data.

## Pending public registration

An invitee signs in anonymously and creates `tournaments/{tournamentId}/pendingRegistrations/{uid}` plus player documents under its `players` subcollection in one batch. Each auth UID can submit only once per tournament. The rules accept these writes only while tournament status is `REGISTRATION` and `registrationOpen` is true; only the tournament owner can read pending team, contact, and player data. Public submissions do not appear in approved teams until the organizer approval flow is implemented. Enable Anonymous as a Firebase Authentication provider before using the public form.

Public registration also requires a reCAPTCHA v3 App Check site key in `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Register the web app with Firebase App Check and enable enforcement for Authentication and Cloud Firestore in the Firebase console; setting the client key alone does not enable server-side enforcement.

## Knockout fixture document

`tournaments/{tournamentId}/fixtures/knockout` stores the generated rounds, team entries, and winner-of-match placeholders. It is public-readable and organizer-created; create-only client behavior prevents a second generation from silently replacing the first bracket. Replacing or editing a saved bracket needs an explicit organizer workflow.

## Round-robin fixture document

`tournaments/{tournamentId}/fixtures/league` stores a single round-robin schedule as rounds with team pairings and byes. It supports up to 64 teams so the schedule stays bounded within one Firestore document. It is public-readable and organizer-created. The client uses a transaction to prevent replacement if the fixture already exists; the saved schedule is not editable yet.

`tournaments/{tournamentId}/fixtures/groups` stores a `GROUP_STAGE` schedule with a `groups` array. Each group has a name, team snapshots, and its round-robin rounds. It supports a combined maximum of 64 teams and is public-readable and organizer-created. The client uses a transaction to prevent replacement if the fixture already exists.

## Live match summary

`matches/{tournamentId}_{fixtureId}` stores the public summary for one scheduled match: fixture identity and team snapshots, current innings, the complete current innings summary, and at most the latest 18 delivery events. Public viewers can read this bounded document; only the tournament organizer can create or update it. Updates cannot change the fixture identity, teams, or creation timestamp. Full delivery history remains separate and is not persisted yet.
