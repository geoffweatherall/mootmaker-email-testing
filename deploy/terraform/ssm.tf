# Publishes the queue URL where anything that reads test emails can look it up, rather than
# running `terraform output` against this repository's state from a sibling checkout. See
# mootmaker-api#94: each component publishes what it owns under /mootmaker/..., and consumers
# look it up by name. Not per environment, because this pipeline is shared by every environment.
resource "aws_ssm_parameter" "sqs_queue_url" {
  name        = "/mootmaker/email-testing/sqs-queue-url"
  description = "URL of the SQS queue that receives every email sent to the test mail domain."
  type        = "String"
  value       = aws_sqs_queue.inbound_email.url
}
