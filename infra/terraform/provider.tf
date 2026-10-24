# Local environment: every AWS API points at Floci (ADR 0008). Against a real account this
# block would have no endpoints and no static credentials; the resources would stay the same.
provider "aws" {
  region     = var.aws_region
  access_key = "test"
  secret_key = "test"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    iam    = var.aws_endpoint
    lambda = var.aws_endpoint
    logs   = var.aws_endpoint
    sns    = var.aws_endpoint
    sqs    = var.aws_endpoint
    sts    = var.aws_endpoint
  }
}
