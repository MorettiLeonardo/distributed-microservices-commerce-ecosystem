# send-email command queue (ADR 0007): identity sends, only the notification Lambda consumes.

resource "aws_sqs_queue" "send_email_dlq" {
  name                      = "ecommerce-notification-send-email-dlq"
  message_retention_seconds = 14 * 24 * 60 * 60
}

resource "aws_sqs_queue" "send_email" {
  name = "ecommerce-notification-send-email"
  # AWS recommends at least 6x the function timeout, so a slow batch is not redelivered mid-run.
  visibility_timeout_seconds = 6 * aws_lambda_function.notification.timeout

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.send_email_dlq.arn
    maxReceiveCount     = 5
  })
}

# Bundled by `pnpm --filter @ecommerce/notification-function build` before applying.
data "archive_file" "notification" {
  type        = "zip"
  source_file = "${path.module}/../../functions/notification/dist/index.js"
  output_path = "${path.module}/.build/notification.zip"
}

resource "aws_iam_role" "notification" {
  name = "ecommerce-notification-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Least privilege: consume this one queue and write logs, nothing else.
resource "aws_iam_role_policy" "notification" {
  name = "consume-send-email"
  role = aws_iam_role.notification.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.send_email.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_lambda_function" "notification" {
  function_name    = "ecommerce-notification-send-email"
  role             = aws_iam_role.notification.arn
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = data.archive_file.notification.output_path
  source_code_hash = data.archive_file.notification.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      SMTP_HOST  = var.smtp_host
      SMTP_PORT  = tostring(var.smtp_port)
      EMAIL_FROM = var.email_from
    }
  }
}

resource "aws_lambda_event_source_mapping" "send_email" {
  event_source_arn = aws_sqs_queue.send_email.arn
  function_name    = aws_lambda_function.notification.arn
  batch_size       = 10
  # Only the failed records of a batch go back to the queue (partial batch response).
  function_response_types = ["ReportBatchItemFailures"]
}
