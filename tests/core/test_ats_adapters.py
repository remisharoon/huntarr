from huntarr_core.browser.adapters.registry import resolve_adapter


def test_resolve_greenhouse_adapter() -> None:
    adapter = resolve_adapter('https://boards.greenhouse.io/acme/jobs/123')
    assert adapter.name == 'greenhouse'


def test_resolve_lever_adapter() -> None:
    adapter = resolve_adapter('https://jobs.lever.co/acme/abc-def')
    assert adapter.name == 'lever'


def test_resolve_workday_adapter() -> None:
    adapter = resolve_adapter('https://acme.wd5.myworkdayjobs.com/en-US/External/job/456')
    assert adapter.name == 'workday'


def test_resolve_fallback_adapter() -> None:
    adapter = resolve_adapter('https://careers.example.com/apply/789')
    assert adapter.name == 'generic'
