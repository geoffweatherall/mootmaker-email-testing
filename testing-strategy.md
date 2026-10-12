# Testing strategy

This repository has no test suite of its own. The pipeline is proved every time a consumer's test reads a
real code through it: mootmaker-webapp's sign-up and password-reset acceptance tests, the Android
acceptance suite, and the release smoke test on `test`. The layers across the whole system are in the
hub's [testing overview](https://github.com/geoffweatherall/mootmaker/blob/main/docs/overview/testing.md).

## Before merging a change

- **Client:** `npm install && npm run typecheck`. A change is not live anywhere until it is tagged and a
  consumer raises its pin, so prove it by pointing one consumer (the webapp's acceptance suite is the
  quickest) at the new commit in an ephemeral environment before tagging.
- **Terraform:** `terraform plan` before any apply. There is one deployment and no copy to try things on,
  so a plan that wants to replace the rule set, topic or queue needs a reason and a time when no release or
  acceptance run is going.

## What the client must keep doing

- **Take only its own mail.** It matches on the recipient and leaves every other message untouched for
  whichever concurrent test is waiting on it.
- **Delete what it takes**, so a later poll never sees a consumed code.
- **Clear only abandoned mail**: messages more than an hour old, which no wait can still want.
- **Parse MIME with `mailparser`** rather than matching against the raw SES notification, which breaks as
  soon as a body is encoded.
