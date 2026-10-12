# mootmaker-email-testing

The shared SES → SNS → SQS pipeline that lets tests read real Cognito verification emails, and the
JavaScript client that reads it.

**Read [README.md](README.md) first**, and [testing-strategy.md](testing-strategy.md) before changing
anything. Keep both true in the same pull request as any change that affects them.

## Working here

- **There is one deployment, shared by every environment and frontend.** `deploy-email-infra.sh` takes no
  environment, and there is no copy to try changes on.
- **Never change the Terraform state key or the resource names** as a side effect of anything else,
  including a rename. See `deploy/terraform/backend.hcl`.
- **`undeploy-email-infra.sh` breaks real-email testing everywhere at once.** Do not run it without being
  asked.
- **`client/` is consumed by tag.** A change is live only once tagged and a consumer raises its pin; keep
  `index.d.ts` in step with `index.js`.
- **The client must never take or delete another test's message.**

---

## Project-wide rules

This repository is part of **Mootmaker**. The hub repository, checked out as a sibling at
`../mootmaker`, holds what applies everywhere:

- How work is done: [`../mootmaker/docs/process/README.md`](https://github.com/geoffweatherall/mootmaker/blob/main/docs/process/README.md).
  Read it before any non-trivial work.
- How the system fits together: [`../mootmaker/docs/overview/`](https://github.com/geoffweatherall/mootmaker/tree/main/docs/overview).
- What to do when something is wrong: [`../mootmaker/docs/runbooks/`](https://github.com/geoffweatherall/mootmaker/blob/main/docs/runbooks/README.md).

The short version:

- Work of any real size starts with a **design** (`../mootmaker/designs/`); a bug or small change starts
  with a **GitHub issue in this repository**, so `Closes #N` works.
- Everything lands on a **branch** through a **pull request**. Reading the diff is the review; merging is
  the approval.
- **A green acceptance run against a real deployed environment** is the definition of working.
- **`test` and `production` change only through a release** (`release.yml` in mootmaker-release). Use an
  ephemeral environment for your own work, and tear it down when you finish.
- **Say what something costs in AWS before creating it.** Under NZ$1 one-off, go ahead and state it;
  more, or anything recurring, ask first.
- **Keep documentation and comments true and current.** If a change makes a document wrong, fixing it is
  part of the change. Describe what is, not how it got here; a comment says what and why.
- **Verify against reality, not your own output**, and **say what actually happened**, including
  failures and skipped steps.

Something not installed? [`../mootmaker/tools/workstation/check.sh`](https://github.com/geoffweatherall/mootmaker/blob/main/tools/workstation/check.sh).

`CLAUDE.md` in this repository is a symlink to this file.
