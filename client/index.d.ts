// Hand-written to match index.js - see that file's header for why there is no build step.
// `npm run typecheck` checks index.js against its JSDoc; keep the two signatures in step.

export interface TestAccount {
  name: string
  email: string
  password: string
}

/** A never-used address on the shared pipeline's domain. Call once per test. */
export function uniqueTestEmail(): string

/** A fresh, never-used identity (unique name, email and password) for a real sign-up. */
export function freshTestAccount(): TestAccount

/**
 * Long-polls the shared queue (SQS_QUEUE_URL) for a message addressed to `email` and returns the
 * 6-digit code in it. Messages for other recipients are left on the queue for their own tests.
 */
export function waitForVerificationCode(email: string, timeoutMs?: number): Promise<string>
