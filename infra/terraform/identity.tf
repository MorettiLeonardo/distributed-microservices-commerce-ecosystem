# Identity publishes its domain events here (CloudEvents, ADR 0006). Any service may subscribe
# its own queue to this topic (fan-out); identity does not know its subscribers.
resource "aws_sns_topic" "identity_events" {
  name = "ecommerce-identity-events"
}
