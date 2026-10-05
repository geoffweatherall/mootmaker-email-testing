# mootmaker-email-testing

The real-email SES→SNS→SQS pipeline that lets any frontend's tests read a genuine Cognito
verification-code email, shared and persistent across every environment and frontend.

**Start by reading [README.md](README.md)** and [testing-strategy.md](testing-strategy.md).

Split out of `mootmaker-test-infra` 2026-09-03 (that repo's ephemeral-environment scripts became
[mootmaker-ephemeral-envs](https://github.com/geoffweatherall/mootmaker-ephemeral-envs) instead —
the two only used to live together because both were leftovers of the earlier `mootmaker-e2e`
split, not because they're related).

## Working here

- **This is shared and persistent, not per-environment or per-frontend.** Unlike every other
  deploying repository, there is one deployment. `deploy-email-infra.sh` takes no environment
  argument.
- **Never change the Terraform state key or the SQS/SNS/SES resource names as a side effect of
  anything else** — including a future repo rename. See `deploy/terraform/backend.hcl`'s comment:
  changing the key re-points Terraform at empty state for already-live resources; changing resource
  names forces a destroy+recreate of a pipeline other tests actively depend on. Both moves this repo
  has already been through (2026-08-19, 2026-09-03) deliberately left these untouched.
- **`client/` is consumed by tag from other repos.** A change to it is not live anywhere until it
  is tagged and a consumer bumps its `#v...` — see README.md#using-it-from-tests.
- **`undeploy-email-infra.sh` would break real-email testing for every frontend at once.** There's
  no ephemeral copy to try things on first.

---

## Project-wide rules

This repository is part of the **mootmaker** project. The workflow rules that apply everywhere live
in the hub repository, which you should find checked out as a sibling directory:

    ../mootmaker/docs/process/README.md

On GitHub: <https://github.com/geoffweatherall/mootmaker/blob/main/docs/process/README.md>

**Read it before doing any non-trivial work here.** The short version:

- Work of any real size starts with a **design document** (`../mootmaker/designs/`), not with code.
- Bugs and small changes start with a **GitHub issue in this repository**, so `Closes #N` works.
- All work happens on a **branch** and lands via a **pull request**. There is no approval step —
  reading the diff is the review, merging is the approval.
- **A green acceptance run against a real deployed environment** is the definition of working — not
  a passing unit suite, and not a successful deploy.
- **Environments are `production`, `test`, or ephemeral.** `test` and `production` change only
  through `release.yml` in mootmaker-release — never `./deploy.sh` by hand. Everything else is
  ephemeral: tear down any you create, as part of finishing rather than as a tidy-up afterwards.
- **If your change makes a document wrong, fixing it is part of the change.**
- **Verify against reality, not your own output.** A script exiting zero is not evidence that the
  thing it was meant to do happened.
- **Say what actually happened.** Failing tests get reported with their output; skipped steps get
  named.

Also useful: [`../mootmaker/docs/roles/`](https://github.com/geoffweatherall/mootmaker/blob/main/docs/roles/)
for which kind of work you are doing, and
[`../mootmaker/tools/workstation/check.sh`](https://github.com/geoffweatherall/mootmaker/blob/main/tools/workstation/check.sh)
if something is not installed.

`CLAUDE.md` in this repository is a symlink to this file.
