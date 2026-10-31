# Habit Circle — PRD

## Original problem statement
Simple community habit tracker for friends/colleagues: sign up/sign in (email+password, no confirmation), My habits (private/shared, When I do it), habit page with Last 7 days tick boxes (YYYY-MM-DD), Days done, Current streak, Community page of shared habits, comments with author names.

## Architecture
- FastAPI + MongoDB (users, habits with completed_dates[], comments); JWT auth (bcrypt, Bearer token + httpOnly cookie)
- React + shadcn; pages: /sign-up, /sign-in, /my-habits, /community, /habits/:id; sidebar + top nav with Sign out

## Implemented (2026-06)
- All 6 spec sections; owner-only ticking (403 otherwise); private habits hidden (404) from others
- Dates computed in user's local time; invalid dates rejected (400)
- Tested: backend 19 tests, full E2E UI flows passed

## Backlog
- P2: change Private/Shared after creation (not requested), password reset
