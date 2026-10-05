# mootmaker-email-testing

A project that is part of my [Claude Code exploration](https://github.com/geoffweatherall/mootmaker).

## Purpose

One persistent, shared piece of testing infrastructure used by more than one frontend of the
[mootmaker](https://github.com/geoffweatherall/mootmaker) project — currently
[mootmaker-webapp](https://github.com/geoffweatherall/mootmaker-webapp), with
[mootmaker-android](https://github.com/geoffweatherall/mootmaker-android) expected to depend on it
later: the real-email SES→SNS→SQS pipeline (`deploy/terraform/`, `deploy-email-infra.sh`,
`undeploy-email-infra.sh`) — one queue any frontend's tests can long-poll for a real Cognito
verification-code email. Deployed once, not per environment, not per frontend. Also the small
JavaScript client that reads that queue — see [Using it from tests](#using-it-from-tests).

Nothing here is a test suite itself; each frontend owns its own `e2e/` and `acceptance/` tests (see
[mootmaker-webapp/testing-strategy.md](https://github.com/geoffweatherall/mootmaker-webapp/blob/main/testing-strategy.md)),
against its own real deployed environment, using whatever's idiomatic for that platform.

See [mootmaker/testing-strategy.md](https://github.com/geoffweatherall/mootmaker/blob/main/docs/reference/testing-strategy.md)
for how this fits the wider cross-repo strategy, and [testing-strategy.md](testing-strategy.md) for
the detail specific to this repo.

## Deploying / undeploying

```bash
./deploy-email-infra.sh      # no environment argument - see testing-strategy.md
./undeploy-email-infra.sh
```

## Finding the queue

The queue URL is published to SSM Parameter Store as `/mootmaker/email-testing/sqs-queue-url`.
Test runners in other repositories read it from there, with `aws ssm get-parameter`, rather than
running `terraform output` against this repository from a sibling checkout (mootmaker-api#94).

## Using it from tests

The repo also ships the **client** for that queue — `client/index.js`, an npm package with three
functions: `uniqueTestEmail()`, `freshTestAccount()` and `waitForVerificationCode(email)`. It
lives here, beside the pipeline it reads, so every consumer shares one copy (mootmaker-release#5).
A divergent copy would not fail loudly: it would show up as test runs intermittently consuming each
other's verification codes.

Consumers depend on it from GitHub, pinned to a tag:

```json
"dependencies": {
  "mootmaker-email-testing": "github:geoffweatherall/mootmaker-email-testing#v1.0.0"
}
```

```ts
import { freshTestAccount, waitForVerificationCode } from 'mootmaker-email-testing'
```

`waitForVerificationCode` reads the queue URL from `SQS_QUEUE_URL`, which each consumer's `run.sh`
sets from the SSM parameter above. Current consumers: mootmaker-webapp's `e2e/` and `acceptance/`
suites, and mootmaker-release's smoke suites.

**Changing the client:** edit `client/index.js` and keep `client/index.d.ts` in step, run
`npm install && npm run typecheck`, bump `version` in `package.json`, merge, then tag `main` as
`v<version>` and push the tag. Consumers pick it up by changing the `#v...` in their own
`package.json`. A tag rather than a branch, so a consumer's lockfile and its CI agree on exactly
which code they run.

It is plain JavaScript with JSDoc types and a hand-written `.d.ts`, not TypeScript, because it is
installed into `node_modules`, where neither Playwright nor Node will compile TypeScript.

## History

This repo is the email-pipeline half of a 2026-09-03 split of `mootmaker-test-infra`, which until
then also owned the ephemeral-environment lifecycle scripts (`create-ephemeral-env.sh` and
friends). That half moved to its own single-purpose repo,
[mootmaker-ephemeral-envs](https://github.com/geoffweatherall/mootmaker-ephemeral-envs), rather
than following this rename — the two were only ever combined by circumstance (both were the
"genuinely cross-repo" leftovers of the original `mootmaker-e2e` split, 2026-08-19), not because
they're actually related. Deployed AWS resources, their Terraform-managed names, and the state key
they're stored under were left exactly as they were through **both** moves — see
[testing-strategy.md](testing-strategy.md) and `deploy/terraform/backend.hcl`'s comment for why.

`mootmaker-test-infra` was itself formerly `mootmaker-e2e`, before each frontend gained its own
`e2e/`/`acceptance/` suites — see
[mootmaker-ephemeral-envs' own History](https://github.com/geoffweatherall/mootmaker-ephemeral-envs#history)
for that earlier split's detail, most of which concerned the ephemeral-environment scripts rather
than this pipeline.

## Status

Built and verified working against real AWS 2026-08-15 (back when this repo was still
`mootmaker-e2e`) — see [testing-strategy.md](testing-strategy.md) for detail. Unchanged, and
untouched by either subsequent repo move.
