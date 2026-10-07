"""Fail closed when the single production environment loses owner approval."""
import json
import os
import subprocess


def api(path):
    return json.loads(subprocess.check_output(["gh", "api", path], text=True))


repo = os.environ["GITHUB_REPOSITORY"]
owner = repo.split("/")[0]
if os.environ["GITHUB_REF"] != "refs/heads/main":
    raise SystemExit("Production releases must use main")
environment = api(f"repos/{repo}/environments/production")
approval = next(
    (r for r in environment.get("protection_rules", []) if r["type"] == "required_reviewers"),
    {},
)
reviewers = approval.get("reviewers", [])
if len(reviewers) != 1 or reviewers[0]["type"] != "User" or reviewers[0]["reviewer"]["login"] != owner:
    raise SystemExit("Production requires the repository owner as its sole reviewer")
if environment.get("can_admins_bypass", True):
    raise SystemExit("Production approval bypass must remain disabled")
if environment.get("deployment_branch_policy") != {"protected_branches": False, "custom_branch_policies": True}:
    raise SystemExit("Production must use explicit branch restrictions")
branches = api(f"repos/{repo}/environments/production/deployment-branch-policies")["branch_policies"]
if len(branches) != 1 or branches[0]["name"] != "main" or branches[0]["type"] != "branch":
    raise SystemExit("Only the main branch may deploy to production")
print("Production owner approval, disabled bypass, and main branch restrictions verified")
