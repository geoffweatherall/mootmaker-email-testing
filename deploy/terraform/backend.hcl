bucket       = "remote-state-431071856068"
key          = "mootmaker-e2e-email/terraform.tfstate"
region       = "us-east-1"
use_lockfile = true

# `key` is a fixed, flat key rather than the "<environment>/<project>/terraform.tfstate" pattern
# every per-environment project computes at init time, like mootmaker-domain's: this is one
# persistent, shared pipeline (see ses.tf). A fixed key outside the <kind>-<YYMMDD>-<rand4> shape
# also means the ephemeral-environment sweep never mistakes it for a stale environment.
#
# The key and the resource names still say "mootmaker-e2e", an older name of this repository, and
# that is deliberate. Changing the key re-points Terraform at empty state for live resources;
# changing the SQS/SNS/SES names forces a destroy and recreate of a pipeline other tests depend on.
# A rename, if ever wanted, is its own deliberate step.
