from __future__ import annotations

from pathlib import Path
from uuid import UUID

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


def build_cover_letter_text(profile: dict, job: dict) -> str:
    full_name = profile.get("full_name", "Candidate")
    summary = profile.get("summary", "")
    role = job.get("title", "the role")
    company = job.get("company", "your company")

    return (
        f"Dear Hiring Team at {company},\n\n"
        f"I am excited to apply for {role}. {summary}\n\n"
        "My background aligns with this opportunity and I am confident I can contribute quickly.\n\n"
        f"Sincerely,\n{full_name}\n"
    )


def write_text_document(content: str, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def write_resume_pdf(profile: dict, job: dict, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_path), pagesize=LETTER)
    width, height = LETTER

    y = height - inch
    c.setFont("Helvetica-Bold", 14)
    c.drawString(inch, y, profile.get("full_name", "Candidate"))
    y -= 20

    c.setFont("Helvetica", 10)
    contact_line = " | ".join(
        [x for x in [profile.get("email"), profile.get("phone"), profile.get("location")] if x]
    )
    c.drawString(inch, y, contact_line)
    y -= 24

    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, f"Target Role: {job.get('title', 'N/A')}")
    y -= 18

    c.setFont("Helvetica", 10)
    lines = [
        profile.get("summary", ""),
        "",
        "Skills: " + ", ".join(profile.get("skills", [])),
    ]

    for line in lines:
        if y < inch:
            c.showPage()
            y = height - inch
            c.setFont("Helvetica", 10)
        c.drawString(inch, y, line[:110])
        y -= 14

    c.save()
    return output_path


def build_output_paths(base_dir: Path, run_id: UUID, job_id: UUID) -> tuple[Path, Path]:
    run_dir = base_dir / str(run_id) / str(job_id)
    return run_dir / "resume.pdf", run_dir / "cover_letter.txt"
