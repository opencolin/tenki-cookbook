"""Shared bootstrap: put the Hermes checkout on sys.path and keep the run hermetic.

The Tenki terminal backend lives at ``tools/environments/tenki.py`` inside the
Hermes source tree. It is not a published package, so both ``main.py`` and
``verify.py`` import it out of a local checkout of the PR branch (see setup.sh).
"""

import os
import sys
import tempfile
from pathlib import Path

DEFAULT_CHECKOUT = Path(__file__).resolve().parent / "hermes-agent"


def hermes_repo() -> Path:
    """Locate the Hermes checkout that carries tools/environments/tenki.py."""
    repo = Path(os.getenv("HERMES_REPO") or DEFAULT_CHECKOUT).expanduser()
    backend = repo / "tools" / "environments" / "tenki.py"
    if not backend.is_file():
        raise SystemExit(
            f"Hermes checkout not found at {repo}.\n"
            "tools/environments/tenki.py only exists on the PR branch, which is\n"
            "still open. Run ./setup.sh first, or point HERMES_REPO at a checkout\n"
            "of LuxorLabs/tenki-hermes-agent#1 (or NousResearch/hermes-agent#64190)."
        )
    return repo


def isolate_hermes_home() -> str:
    """Point HERMES_HOME at a scratch dir before importing the backend.

    TenkiEnvironment.__init__ runs ``FileSyncManager.sync(force=True)``, which
    enumerates the host's Hermes home (credentials, skills, cache) and uploads it
    into the sandbox -- that is the real product behavior, so the agent inside the
    sandbox can use your API keys. For a cookbook run we do NOT want to ship a
    developer's real ~/.hermes/auth.json to a cloud VM, so we redirect
    HERMES_HOME (read by hermes_constants.get_hermes_home) at an empty temp dir.
    On a clean machine the sync is a no-op either way.

    Delete this call if you want to exercise the credential sync for real.
    """
    if not os.getenv("HERMES_KEEP_REAL_HOME"):
        os.environ["HERMES_HOME"] = tempfile.mkdtemp(prefix="hermes-cookbook-home-")
    return os.environ["HERMES_HOME"]


def bootstrap() -> Path:
    """Prepare sys.path + env. Call before importing anything from Hermes."""
    repo = hermes_repo()
    if str(repo) not in sys.path:
        sys.path.insert(0, str(repo))
    isolate_hermes_home()
    # The backend gate and factory both read this; set it so
    # check_terminal_requirements() validates the tenki branch.
    os.environ.setdefault("TERMINAL_ENV", "tenki")
    return repo


def require_credentials() -> None:
    """Fail fast with the same rule the Hermes backend gate applies."""
    if not (os.getenv("TENKI_API_KEY") or os.getenv("TENKI_AUTH_TOKEN")):
        raise SystemExit(
            "Set TENKI_API_KEY (tk_...) or TENKI_AUTH_TOKEN.\n"
            "If your credential maps to more than one Tenki project, also set "
            "TENKI_PROJECT_ID (proj_...)."
        )


def terminate_task_sandboxes(task_id: str) -> int:
    """Hard-terminate every sandbox tagged for *task_id*.

    ``TenkiEnvironment.cleanup()`` PAUSES a persistent sandbox (that is the point
    of the backend -- the filesystem survives). A test run must not leave paused
    VMs behind, so we close them explicitly through the SDK using the backend's
    own tag helper.
    """
    from tenki_sandbox import Client
    from tools.environments.tenki import _task_tag

    closed = 0
    client = Client()
    try:
        for sandbox in client.list(tags=[_task_tag(task_id)]):
            if sandbox.state in {"TERMINATING", "TERMINATED"}:
                continue
            try:
                sandbox.close()
                closed += 1
            except Exception as exc:  # best effort -- idle timeout reaps the rest
                print(f"  warn: could not close {sandbox.id}: {exc}")
    finally:
        client.close()
    return closed
