// @ts-check
// The client half of this repo's pipeline: what a frontend's tests call to read the mail it
// delivers. Lives here, next to the queue it reads, so every consumer shares one copy
// (mootmaker-release#5) - consumed as a git dependency, see README.md#using-it-from-tests.
//
// Plain JavaScript with JSDoc types and a hand-written index.d.ts, not TypeScript. Consumers install
// this into node_modules, and neither Playwright's transform nor Node's own type stripping will
// compile TypeScript there, so shipping .ts would need a build step on every install.
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { randomInt, randomUUID } from 'node:crypto'
import { simpleParser } from 'mailparser'

const MAIL_DOMAIN = 'mail.mootmaker.com'

// One shared, persistent queue, not one per environment, per test, or per frontend (see
// mootmaker/docs/reference/testing-strategy.md#reading-cognitos-emails-in-tests), so concurrent
// runs/tests distinguish their own mail purely by address, not by infrastructure. Every test that
// needs a real emailed code should call this once and use the result as the account's email - never
// reuse an address across tests, or a slow/retried long-poll could pick up another test's message.
/** @returns {string} */
export function uniqueTestEmail() {
  return `e2e-${randomUUID()}@${MAIL_DOMAIN}`
}

/**
 * A fresh, never-used identity for a real sign-up - see uniqueTestEmail for why every test needs
 * its own.
 *
 * The name carries the same uniqueness requirement as the email: mootmaker-api#70 made a name
 * collision (case/whitespace-insensitive) an outright sign-up rejection rather than something
 * silently allowed, so a fixed literal name here would only ever succeed once per environment - the
 * first caller creates the Person, and PreSignUpNameCollisionHandler rejects every one after it.
 * Seen for real: every test after the first to call this in a given run failed at "Verification
 * code never appears" or with a UserLambdaValidationException.
 *
 * @returns {{ name: string, email: string, password: string }}
 */
export function freshTestAccount() {
  return {
    name: `Test Account ${randomInt(100_000, 999_999)}`,
    email: uniqueTestEmail(),
    // Meets the deployed pool's password policy (>=10 chars, a lowercase letter, a number - see
    // mootmaker-api/deploy/terraform/cognito.tf) with a bit of per-run variance, mostly so a
    // hardcoded literal isn't sitting in source control for no reason.
    password: `test-pw-${randomInt(100_000, 999_999)}`,
  }
}

const sqsClient = new SQSClient({})

/** @returns {string} */
function queueUrl() {
  const url = process.env.SQS_QUEUE_URL
  if (!url) {
    throw new Error(
      'SQS_QUEUE_URL is not set - read it from SSM /mootmaker/email-testing/sqs-queue-url (see your run.sh).',
    )
  }
  return url
}

/**
 * Long-polls the shared inbound-mail queue until a message addressed to `email` arrives, then
 * extracts the verification code from its body and deletes the message (so it isn't left for a
 * later, unrelated poll to stumble over - the queue's 14-day retention in deploy/terraform/sqs.tf
 * exists for debugging a stuck run, not as a reason to leave consumed messages lying around).
 *
 * Cognito's default verification email is short, plain-text-or-simple-HTML, multipart MIME -
 * `mailparser` handles the actual MIME/transfer-encoding decoding (quoted-printable, base64,
 * etc.) rather than this function guessing at it by regexing the raw SES notification body,
 * which would be fragile the moment the message isn't already plain ASCII.
 *
 * Any message addressed to someone else is left on the queue untouched (not deleted, not
 * consumed) precisely because another concurrent test may be waiting on it. SQS standard queues
 * do not guarantee ordering, so matching by recipient is the only safe way to share one queue.
 *
 * @param {string} email
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
export async function waitForVerificationCode(email, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { Messages } = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl(),
        MaxNumberOfMessages: 10,
        // Long poll - avoids a tight empty-queue loop while still returning immediately once
        // SES/SNS actually deliver something.
        WaitTimeSeconds: 10,
      }),
    )

    for (const message of Messages ?? []) {
      if (await deleteIfAbandoned(message)) continue
      const code = await tryExtractCodeForRecipient(message.Body ?? '', email)
      if (code) {
        if (message.ReceiptHandle) {
          await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl(), ReceiptHandle: message.ReceiptHandle }))
        }
        return code
      }
    }
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for a verification code addressed to ${email}`)
}

/**
 * Returns the code if this message is addressed to `email` and a code could be found in it;
 * returns null otherwise (wrong recipient, or a real message that unexpectedly had no code -
 * either way, the caller must not delete it, so leaving message-shape assumptions loose here and
 * just returning null is the safe default).
 *
 * @param {string} rawBody
 * @param {string} email
 * @returns {Promise<string | null>}
 */
async function tryExtractCodeForRecipient(rawBody, email) {
  /** @type {{ mail?: { destination?: string[] }, content?: string, receipt?: { recipients?: string[] } }} */
  let notification
  try {
    notification = JSON.parse(rawBody)
  } catch {
    return null
  }

  const recipients = notification.mail?.destination ?? notification.receipt?.recipients ?? []
  if (!recipients.some((recipient) => recipient.toLowerCase() === email.toLowerCase())) {
    return null
  }

  const rawMime = notification.content
  if (!rawMime) {
    return null
  }

  const parsed = await simpleParser(rawMime)
  // mailparser types html as `string | false` (false = no HTML part) rather than undefined, so
  // it doesn't chain through `??` the way text's `string | undefined` does.
  const bodyText = parsed.text || parsed.html || ''
  // Cognito's default template reads "Your verification code is 123456" (sign-up) / similar
  // wording for a reset code - looking for any standalone 6-digit run is deliberately loose about
  // the surrounding wording (which isn't part of this project's contract, just Cognito's default
  // copy) rather than brittle about exact phrasing.
  const match = bodyText.match(/\b(\d{6})\b/)
  return match ? match[1] : null
}

/** Older than any test would still be waiting for: every wait here gives up within a minute. */
const ABANDONED_AFTER_MS = 60 * 60 * 1000

/**
 * Deletes a message nobody can still be waiting for, and says whether it did.
 *
 * Mail no test ever consumed - a sign-up confirmation nobody read, a bounce - used to stay on the
 * shared queue for its full 14-day retention. Hundreds built up, and every poll had to wade through
 * them ten at a time, hiding each batch from concurrent runs for the visibility timeout while it
 * did. Clearing them as they are met keeps the queue near-empty without a separate job.
 *
 * @param {{ Body?: string, ReceiptHandle?: string }} message
 * @returns {Promise<boolean>}
 */
async function deleteIfAbandoned(message) {
  let sentAt
  try {
    sentAt = Date.parse(JSON.parse(message.Body ?? '').mail?.timestamp ?? '')
  } catch {
    return false
  }
  if (Number.isNaN(sentAt) || Date.now() - sentAt < ABANDONED_AFTER_MS || !message.ReceiptHandle) return false
  await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl(), ReceiptHandle: message.ReceiptHandle }))
  return true
}
