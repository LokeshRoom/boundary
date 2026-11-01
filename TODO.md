# Build TODO

## MVP delivery plan

- [x] Review the PRD, choose the Vite + React + TypeScript path, and identify security and Spark-plan constraints.
- [x] Build the mobile-first PWA shell and preview tournament dashboard with session-only creation.
- [x] Add Firebase web SDK initialization with optional environment-based configuration.
- [x] Defer Firebase Auth and Firestore SDK loading until a Firebase-backed feature requests it.
- [x] Add organizer Google sign-in, sign-out, and auth-state display.
- [x] Document the initial tournament data contract and public/private team data boundary.
- [x] Persist organizer-owned tournament creation and load the signed-in organizer's tournaments.
- [x] Capture and persist tournament start/end dates and primary venue.
- [x] Capture and persist balls-per-over and powerplay settings.
- [x] Define public approved team/player records and private captain contact records.
- [x] Let organizers create approved teams with captain contacts stored in private records.
- [x] Persist approved team counts atomically and restore them when tournaments load.
- [x] Build organizer authentication and persistent tournament setup.
- [ ] Implement and emulator-test Firestore rules for tournament ownership and team registration privacy.
- [x] Accept private public team registration submissions with player rosters on open tournaments.
- [x] Show pending public team registrations and private captain details to the organizer.
- [x] Approve pending public registrations into public teams and rosters with private captain contacts.
- [x] Reject pending registrations and remove their private roster records.
- [x] Let the organizer open or close tournament registration and persist the setting.
- [x] Add organizer roster entry for player name, jersey number, and role.
- [x] Preview knockout rounds with automatic byes and winner placeholders.
- [x] Persist the generated knockout bracket as a public, organizer-created fixture document.
- [x] Load the saved knockout bracket when reopening its preview.
- [x] Preview a single round-robin schedule for league tournaments.
- [x] Persist a generated round-robin schedule as a public fixture document.
- [x] Load saved league schedules when the organizer opens the schedule preview.
- [x] Preview configurable group-stage round-robin schedules.
- [x] Persist and reload generated group-stage fixtures.
- [x] Identify concrete playable matches from saved knockout, league, and group schedules.
- [x] Select a saved fixture into the session-only scoring preview.
- [ ] Select group-stage playoff qualifiers and generate the playoff bracket.
- [x] Add tested innings accounting for runs, extras, wickets, legal balls, overs, and undoing the last delivery.
- [x] Detect innings completion at the overs limit or when all but one batter are out.
- [x] Add a local-only scoring preview with run, wide, no-ball, wicket and replacement batter, recent-ball, undo, and batter-strike rotation controls.
- [ ] Build the organizer scoring console around a selected match and persist match/over state.
- [x] Calculate batter runs, balls, boundaries, strike rate, and dismissal from delivery history.
- [x] Calculate bowler runs conceded, legal balls, wickets, overs, and economy from delivery history.
- [x] Group historical delivery events into over-numbered batches for compact persistence.
- [x] Restore delivery order from validated over batches.
- [x] Build bounded live match snapshots with full totals and the latest 18 deliveries.
- [x] Add save/load functions for bounded live match summary documents.
- [ ] Emulator-test public live match reads and organizer-only match writes.
- [ ] Persist historical delivery over batches with public reads and organizer-only writes.
- [x] Compose complete innings scorecards from innings, batting, and bowling summaries.
- [ ] Publish full scorecards for completed and live matches.
- [ ] Publish the live scoreboard and historical scorecard with quota-aware reads.
- [ ] Calculate standings and net run rate; render brackets.
- [ ] Verify Firebase Spark limits, production rules, and Firebase Hosting deployment.

## PRD implementation notes

- Keep all user uploads out of V1. Firebase Storage requires Blaze; use generated badges.
- Public viewers need public tournament and score data, but must never receive captain contact details.
- Validate organizer ownership for every write, including document creation; public registration only creates bounded pending submissions while registration is open.
- Keep a compact live match document and store delivery history by over to reduce Firestore operations.
- The current React shell uses session-only sample data; it is not authenticated or persistent yet.
- Mark an item complete only after its implementation and validation are done.
