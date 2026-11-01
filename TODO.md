# Build TODO

## MVP delivery plan

- [x] Review the PRD, choose the Vite + React + TypeScript path, and identify security and Spark-plan constraints.
- [x] Build the mobile-first PWA shell and preview tournament dashboard with session-only creation.
- [x] Add Firebase web SDK initialization with optional environment-based configuration.
- [x] Defer Firebase Auth and Firestore SDK loading until a Firebase-backed feature requests it.
- [x] Add organizer Google sign-in, sign-out, and auth-state display.
- [ ] Build organizer authentication and persistent tournament setup.
- [ ] Define Firestore documents and security rules; keep captain contact details out of public team records.
- [ ] Add public team registration, organizer approval, and roster management.
- [ ] Generate knockout, round-robin, and group-stage fixtures.
- [ ] Implement ball-by-ball scoring, scorecard stats, and undo.
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
