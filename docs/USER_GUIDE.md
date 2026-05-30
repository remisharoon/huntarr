---
title: User Guide
description: User guide for Huntarr cloud app with Clerk auth and BYOK providers.
---

# User Guide

## Sign In

1. Open the app.
2. Sign in with Clerk.
3. You will be redirected to the dashboard.

## Navigate

Use the sidebar routes:

- Overview
- Runs
- Jobs
- Manual
- Profile
- Settings

## Configure BYOK (Required)

In **Settings**:

1. Add OpenRouter API key.
2. Choose OpenRouter model.
3. Add Steel.dev API key.
4. Optional Steel project ID.
5. Test both keys.
6. Save.

## Profile

In **Profile**, maintain your:

- Identity
- Summary
- Skills
- Experience
- Education
- Resume info

This profile drives job matching and AI outputs.

## Job Sources

Enable/disable sources from **Settings** and start hunts from the app.

Default enabled sources:

- RemoteOK
- WeWorkRemotely
- Remotive
- The Muse
- Arbeitnow

Optional sources that require credentials:

- Adzuna (`app_id` + `app_key`)
- USAJobs (API key + User-Agent email)

Notes:

- Brave Search is shown in Settings but unavailable in this cloud build.
- Some providers require attribution or conservative polling; keep source URL visible in the Jobs list.

## Notes

- OpenRouter uses BYOK policy.
- Steel.dev uses BYOK policy.
- Credentials are user-scoped.

## Need Help

See [Troubleshooting](TROUBLESHOOTING.md).
