"""Domain constants used across API and worker services."""

RESTRICTED_PLATFORM_DOMAINS = {
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
}

DEFAULT_QUEUE_NAME = "hunt"
MANUAL_ACTION_TYPES = {"captcha", "email_verify", "2fa", "unexpected_form"}
