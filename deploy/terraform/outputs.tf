output "sqs_queue_url" {
  description = "URL of the queue tests long-poll for inbound verification-code email (see README.md)."
  value       = aws_sqs_queue.inbound_email.id
}

output "sqs_queue_arn" {
  description = "ARN of the inbound-email SQS queue."
  value       = aws_sqs_queue.inbound_email.arn
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic SES publishes inbound mail notifications to."
  value       = aws_sns_topic.inbound_email.arn
}

output "ses_receipt_rule_set_name" {
  description = "Name of the active SES receipt rule set for mail.mootmaker.com."
  value       = aws_ses_receipt_rule_set.e2e.rule_set_name
}
