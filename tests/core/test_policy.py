from huntarr_core.connectors.policies import can_use_authenticated_flow, is_restricted_platform


def test_restricted_platform_policy() -> None:
    assert is_restricted_platform('https://www.linkedin.com/jobs/view/123')
    assert not can_use_authenticated_flow('https://www.linkedin.com/jobs/view/123')
    assert can_use_authenticated_flow('https://jobs.lever.co/acme/123')
