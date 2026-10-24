# Values the services need in their .env files.

output "identity_events_topic_arn" {
  value = aws_sns_topic.identity_events.arn
}

output "send_email_queue_url" {
  value = aws_sqs_queue.send_email.url
}

output "send_email_dlq_url" {
  value = aws_sqs_queue.send_email_dlq.url
}
