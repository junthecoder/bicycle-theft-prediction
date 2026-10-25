"""Generate reviewable Markdown/CSV views from the canonical audit JSON register."""

import csv
import json
from collections import Counter
from pathlib import Path


def main():
    directory = Path(__file__).resolve().parents[1] / "docs" / "audit"
    report = json.loads((directory / "findings.json").read_text())
    findings = report["findings"]
    counts = Counter(item["severity"] for item in findings)
    lines = [
        "# Findings and fixes",
        "",
        f"Audit date: {report['date']}. Baseline: `{report['baseline']}`. Delivery branch: `{report['delivery_branch']}`. API version: `{report['api_version']}`.",
        "",
        f"{len(findings)} fixed findings: {counts['high']} high, {counts['medium']} medium, {counts['low']} low; no critical finding confirmed. Three high findings are published advisories affecting one development dependency. Closely related fixes share branches/commits.",
        "",
        "The baseline assessment, validation evidence and limitations are in [README.md](README.md). The canonical register is [findings.json](findings.json); [findings.csv](findings.csv) contains the same finding fields.",
        "",
        "| ID | Severity | Category | Finding | Fix |",
        "| --- | --- | --- | --- | --- |",
    ]
    for item in findings:
        lines.append(
            f"| {item['id']} | {item['severity']} | {item['category']} | {item['title']} | `{item['fix_commit']}` |"
        )
    for item in findings:
        lines += [
            "",
            f"## {item['id']}: {item['title']}",
            "",
            f"**{item['severity'].upper()} / {item['priority']}** · {item['category']} · {item['component']} · complexity: {item['complexity']} · status: {item['status']}",
            "",
            "Files: " + ", ".join(f"`{path}`" for path in item["files"]) + ".",
            "",
            f"**Observed:** {item['current_behavior']}",
            "",
            f"**Expected:** {item['expected_behavior']}",
            "",
            f"**Root cause:** {item['root_cause']}",
            "",
            f"**Impact:** {item['impact']}",
            "",
            f"**Reproduce:** {item['reproduction']}",
            "",
            f"**Verify:** {item['verification']}",
            "",
            f"**Audit trail:** `{item['branch']}` → `{item['fix_commit']}`.",
        ]
        if item["sources"]:
            lines += [
                "",
                "Sources: "
                + ", ".join(f"[advisory]({url})" for url in item["sources"])
                + ".",
            ]
    for field in ["assumptions", "limitations", "recommendations"]:
        lines += ["", f"## {field.title()}", ""]
        lines += [f"- {value}" for value in report[field]]
    (directory / "findings.md").write_text("\n".join(lines) + "\n")
    with (directory / "findings.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(findings[0]))
        writer.writeheader()
        writer.writerows(
            {
                key: "; ".join(value) if isinstance(value, list) else value
                for key, value in item.items()
            }
            for item in findings
        )
    print(f"Exported {len(findings)} findings: {dict(counts)}")


if __name__ == "__main__":
    main()
