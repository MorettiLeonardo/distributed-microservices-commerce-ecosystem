variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "aws_endpoint" {
  description = "AWS API endpoint (Floci inside the compose network)."
  type        = string
  default     = "http://floci:4566"
}

variable "smtp_host" {
  description = "SMTP server reachable from Lambda containers (Mailpit in the compose network)."
  type        = string
  default     = "mailpit"
}

variable "smtp_port" {
  type    = number
  default = 1025
}

variable "email_from" {
  type    = string
  default = "no-reply@ecommerce.dev"
}
