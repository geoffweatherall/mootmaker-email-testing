# Testing strategy

The overall cross-repo strategy (environments, the approach to reading Cognito's emails in tests,
and how "vibe coding" shapes all of this) is recorded in
[mootmaker/testing-strategy.md](https://github.com/geoffweatherall/mootmaker/blob/main/docs/reference/testing-strategy.md).
This document covers what's specific to this repo.

## Purpose

This repo owns the one piece of the testing strategy that's a **persistent, shared** piece of
infrastructure rather than something any single frontend or environment creates for itself: the
real Cognito email reading pipeline — the SES→SNS→SQS pipeline any frontend's tests can long-poll
for a real verification-code email, when a scenario specifically needs to prove that path works.
See [Real email reading](#real-email-reading-option-2--sessnssqs) below.

Each frontend owns its *own* `e2e/` (thin, real-infra, curated) and `acceptance/` (broader,
use-case-driven) test suites, in its own repo, using whatever's idiomatic there — TypeScript +
Playwright for [mootmaker-webapp](https://github.com/geoffweatherall/mootmaker-webapp), presumably
Kotlin + Espresso/Compose for `mootmaker-android` later. See
[mootmaker-webapp/testing-strategy.md](https://github.com/geoffweatherall/mootmaker-webapp/blob/main/testing-strategy.md)
for that repo's suites, and [mootmaker/use-cases.md](https://github.com/geoffweatherall/mootmaker/blob/main/docs/reference/use-cases.md)
for the client-agnostic scenario list they draw on.

**Ephemeral-environment lifecycle** — standing up/tearing down a matched
[mootmaker-api](https://github.com/geoffweatherall/mootmaker-api) +
[mootmaker-webapp](https://github.com/geoffweatherall/mootmaker-webapp) pair under one environment
name, and sweeping up anything left behind — is the *other* genuinely cross-repo piece of the
testing strategy, but lives in a separate, single-purpose repo,
[mootmaker-ephemeral-envs](https://github.com/geoffweatherall/mootmaker-ephemeral-envs), not here.
See that repo's own `testing-strategy.md`. The two used to live together in one repo
(`mootmaker-test-infra`, itself formerly `mootmaker-e2e`) until they were split 2026-09-03 — this
repo is the email-pipeline half of that split; see [README.md's History](README.md#history).

## Real email reading (Option 2 — SES → SNS → SQS)

This repo owns the receipt rule, SNS topic, and SQS queue (the domain identity and MX record live
in [mootmaker-domain](https://github.com/geoffweatherall/mootmaker-domain) instead — see
[mootmaker/testing-strategy.md](https://github.com/geoffweatherall/mootmaker/blob/main/docs/reference/testing-strategy.md#reading-cognitos-emails-in-tests)
for the full design, including why this is **one persistent, shared pipeline** rather than
something created per ephemeral environment or per frontend). Any frontend's test suite long-polls
the queue and parses the verification code out of the real email body, filtering by a unique
address tag per run. Used only for the small number of tests whose specific purpose is proving
Cognito's email sending actually works — everywhere else, tests use the Cognito Admin-API bypass
instead (`AdminConfirmSignUp` / `AdminSetUserPassword` — see mootmaker/testing-strategy.md's
"Bypassing the code requirement entirely").

**Deployed 2026-08-15, unchanged since**: `deploy/terraform/` here has the receipt rule set/rule,
SNS topic (with a policy letting the SES rule publish to it), and SQS queue (subscribed to the
topic, raw delivery enabled), plus `deploy-email-infra.sh`/`undeploy-email-infra.sh` at the repo
root, matching mootmaker-domain's no-environment-argument pattern (see "No environment argument"
below). The domain identity is referenced via `data "aws_ses_domain_identity"` rather than a
remote-state read, mirroring how mootmaker-api/mootmaker-webapp already find mootmaker-domain's
hosted zone. `mail.mootmaker.com` genuinely receives mail into `sqs_queue_url`, and this pipeline
is exercised end-to-end by mootmaker-webapp's `e2e/sign-up.spec.ts` and `e2e/forgot-password.spec.ts`.

**Two repo moves since, resources untouched both times**: first `mootmaker-e2e` →
`mootmaker-test-infra` (2026-08-19), then `mootmaker-test-infra` → this repo,
`mootmaker-email-testing` (2026-09-03, split out from the ephemeral-environment scripts, which
became `mootmaker-ephemeral-envs`). Both times, the deployed AWS resources, their Terraform-managed
names, and the state key they're stored under (`mootmaker-e2e-email/terraform.tfstate`) were left
exactly as they were — see `deploy/terraform/backend.hcl`'s comment for why (changing any of them
would mean either re-pointing Terraform at an empty state for already-live resources, or forcing a
destroy+recreate of a pipeline other tests actively depend on — not something to fold silently into
a repo move).

### No environment argument

This Terraform takes no environment name — deployed once and left running, like mootmaker-domain's
hosted zone. Reasoning (see also `deploy/terraform/backend.hcl`'s and `ses.tf`'s comments):

- SES allows only one *active* receipt rule set per region/account, so a fresh rule set per
  ephemeral e2e run would mean concurrent runs fighting over which one is active.
- Concurrency is instead handled at the message level: each e2e run sends to a uniquely-tagged
  address under the shared subdomain and filters the SQS queue for its own tag.
- A fixed backend state key also means the ephemeral-environment sweep scripts (in
  [mootmaker-ephemeral-envs](https://github.com/geoffweatherall/mootmaker-ephemeral-envs) — which
  group by first path segment and match only the `<kind>-<YYMMDD>-<rand4>` shape) never mistake
  this persistent infrastructure for a stale ephemeral environment.
