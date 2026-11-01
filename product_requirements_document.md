# Product Requirements Document (PRD): Cricket Tournament & Live Ball-by-Ball Scoring Web App

## 1. Executive Summary
A responsive, mobile-first PWA web application hosted on **Firebase Hosting** that enables a single tournament organizer to create, manage, and score cricket tournaments in real time. Public viewers and players can browse tournaments, view live ball-by-ball scores without logging in, and register teams via shareable invite links. The entire V1 architecture is strictly engineered to operate within the **Firebase Spark (Free) Plan** limits by eliminating user file uploads and optimizing Firestore read/write patterns.

---

## 2. Target Audience & User Roles

| Role | Authentication | Key Capabilities |
| :--- | :--- | :--- |
| **Organizer (Admin)** | Firebase Auth (Google / Email) | Create and configure tournaments, generate shareable registration links, approve/manage teams, generate fixtures, score matches ball-by-ball, manage match states. |
| **Team Captain / Registrant** | Lightweight Auth or Unauthenticated Form (with OTP/Email link) | Open invite link, submit team registration (team name, player roster with text-based names/roles), view registration status. |
| **Public Viewer** | None (Anonymous / Public Read) | View public tournaments, brackets, standings, schedules, and live ball-by-ball scorecards via shared links. |

---

## 3. Core Functional Requirements

### 3.1 Tournament Management (Organizer)
* **Tournament Creation:** Define tournament name, dates, venue(s), overs per innings, balls per over (default 6), powerplay rules, and tournament format.
* **Supported Formats:**
  1. **Single-Elimination Knockout:** Automated bracket generation (byes handled automatically if team count is not a power of 2).
  2. **League / Round Robin:** Every team plays every other team $N$ times; automated points table with Net Run Rate (NRR) calculation.
  3. **Group Stage + Knockout Playoffs:** Teams divided into groups (e.g., Group A, Group B) for round-robin play; top $X$ teams per group advance to Semi-Finals/Finals.
* **Shareable Invite Links:** Generate a unique URL (`/t/{tournamentId}/register`) with a toggle to open/close registrations.
* **Visual Identity (Zero-Upload Compliance):** Instead of image uploads for team/tournament logos, provide a built-in **Avatar & Crest Generator** (curated SVG icons, initials, and color palettes stored as lightweight strings).

### 3.2 Team Registration & Roster Management
* **Public Registration Flow:** Accessing the invite link displays tournament details and a registration form.
* **Roster Input:** Captains enter Team Name, Captain Contact, and a list of players (Name, Jersey Number, Role: Batter, Bowler, All-Rounder, Wicketkeeper).
* **Approval Workflow:** Organizer reviews submitted teams and marks them as *Approved* or *Rejected* before locking the fixture list.

### 3.3 Live Ball-by-Ball Scoring Engine
* **Pre-Match Setup:** Select playing XI from registered roster, record toss winner and decision (Bat/Bowl), and select opening striker, non-striker, and opening bowler.
* **Scoring Console (Mobile-Optimized Keypad):**
  * **Standard Deliveries:** `0`, `1`, `2`, `3`, `4`, `6` runs.
  * **Extras:** Wide (`WD`), No-Ball (`NB` + free hit state tracking), Bye (`B`), Leg-Bye (`LB`), Penalty runs.
  * **Wickets:** Bowled, Caught (select fielder), LBW, Run Out (select batter out + fielder + runs completed), Stumped, Hit Wicket, Retired Hurt/Out.
  * **State Transitions:** Automatic strike rotation on odd runs and end of over; prompt for next batter on wicket; prompt for next bowler at the end of a 6-ball legal over; automatic innings break trigger when all-out or overs completed.
  * **Undo / Edit:** One-tap **Undo Last Ball** (reverts state and recalculates stats) to fix scorer typos immediately.

### 3.4 Public Viewing Experience
* **Live Match Center:** Real-time scoreboard displaying current score, overs, run rate, required run rate (2nd innings), current partnership, active batters (runs, balls, 4s, 6s, SR), active bowler (O-M-R-W, Econ), and a recent balls timeline (`1` `0` `W` `4` `WD` `2`).
* **Full Scorecard Tab:** Expandable batting and bowling tables for both innings, fall of wickets (FoW), and extras breakdown.
* **Standings & Brackets Tab:** Auto-updated points table (P, W, L, T, NR, Pts, NRR) for League/Group stages and visual bracket tree for Knockouts.

---

## 4. Technical Architecture & Firebase Spark Plan Optimization

To stay strictly within the **Firebase Spark Plan** (50k Firestore reads/day, 20k writes/day, 1 GiB storage, no Cloud Storage billing, no Cloud Functions paid tier), the architecture uses the following design:

* **Frontend:** React / Next.js (Static Export) or Vue/Vite SPA, styled with Tailwind CSS, hosted on **Firebase Hosting** (10 GB storage, 360 MB/day transfer).
* **Database:** **Cloud Firestore** with client-side SDK. All business logic (NRR calculation, bracket progression, strike rotation) executes on the Organizer's client device and commits via atomic `writeBatch()`.
* **No User File Uploads:** Firebase Cloud Storage is completely disabled. Team badges use deterministic SVG/CSS configurations (`{ icon: "shield", primaryColor: "#1E40AF", initials: "RC" }`).
* **Firestore Read/Write Optimization (Crucial for Live Scoring):**
  * *Problem:* If 200 viewers watch a match and every ball queries 20 sub-collection documents, 50,000 daily reads will exhaust in a single innings.
  * *Solution (Denormalized Live State Document):* Maintain a single lightweight document per active match (`matches/{matchId}`) containing the complete current summary, active batters, active bowler, and the last 18 balls. Viewers attach a single `onSnapshot` listener to `matches/{matchId}` (1 read per ball per active viewer).
  * *Historical Ball Log:* Store full ball-by-ball history batched by over in `matches/{matchId}/overs/{overNumber}` rather than 1 document per ball (reduces writes and historical scorecard reads by 6x).

---

## 5. Firestore Data Model (High-Level Schema)

* `tournaments/{tournamentId}`
  * `name`, `format` (`KNOCKOUT` | `LEAGUE` | `GROUP_KNOCKOUT`), `oversPerInnings`, `status` (`REGISTRATION` | `UPCOMING` | `LIVE` | `COMPLETED`), `inviteCode`, `organizerUid`, `settings` (group count, qualifiers per group).
* `tournaments/{tournamentId}/teams/{teamId}`
  * `name`, `shortName`, `badgeConfig` (color/SVG id), `groupId`, `status` (`PENDING` | `APPROVED`), `players`: Array of `{ id, name, role }`, `stats`: `{ played, won, lost, tied, points, runsScored, oversFaced, runsConceded, oversBowled, nrr }`.
* `matches/{matchId}` *(Single real-time listener target for viewers)*
  * `tournamentId`, `stage` (`GROUP` | `QF` | `SF` | `FINAL`), `teamA`, `teamB`, `toss`, `status`, `currentInnings` (1 | 2), `scoreSummary`, `striker`, `nonStriker`, `currentBowler`, `recentBalls` (Array of last 12-18 deliveries), `battingCardSummary`, `bowlingCardSummary`.
* `matches/{matchId}/overs/{overNumber}`
  * `innings`, `overNumber`, `bowlerId`, `deliveries`: Array of ball objects `{ ballNumber, legalBall, runsOffBat, extrasType, extrasRuns, isWicket, dismissalType, dismissedPlayerId, strikerId, nonStrikerId }`.

---

## 6. Security Rules (`firestore.rules`)
* **Public Read:** `allow read: if true;` on `tournaments`, `teams`, `matches`, and `overs`.
* **Registration Write:** `allow create: if request.resource.data.status == 'PENDING'` on `tournaments/{tournamentId}/teams` when `tournament.status == 'REGISTRATION'` (validates schema lengths and blocks file URLs).
* **Organizer Write:** `allow write: if request.auth != null && request.auth.uid == resource.data.organizerUid;` for all tournament management, match creation, and ball-by-ball scoring updates.

---

## 7. Scope & Phasing

* **In Scope for V1 (MVP):**
  * Organizer Google Sign-In, tournament creation across all 3 formats, shareable registration link, public team registration, fixture generator, mobile-first ball-by-ball scoring console with Undo, real-time public scorecard, automated NRR & points table, SVG team badge selector.
* **Out of Scope for V1:**
  * User-uploaded photos/logos, multi-scorer concurrent editing on the same match, DLS (Duckworth-Lewis-Stern) rain calculations, push notifications (FCM), and player career profile aggregation across multiple organizers.