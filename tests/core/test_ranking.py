from huntarr_core.ranking import score_job
from huntarr_core.types import SearchConfig


def test_score_job_keyword_bias() -> None:
    cfg = SearchConfig(
        role_keywords=['backend', 'python'],
        exclude_keywords=['senior manager'],
        locations=['remote'],
        remote_only=True,
    )
    score, explanation = score_job(
        {
            'title': 'Backend Python Engineer',
            'description': 'Build APIs and worker systems.',
            'location': 'Remote',
        },
        cfg,
    )
    assert score > 0
    assert 'backend' in [x.lower() for x in explanation['matched_keywords']]
