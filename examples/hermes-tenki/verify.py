"""Verify the Hermes Tenki terminal backend against LIVE Tenki.

Exits 0 only if every check passes. Any mismatch prints the expected and actual
value and exits 1. No pytest, no mocks, no LLM key -- just TENKI_API_KEY.

    export TENKI_API_KEY=tk_...
    ./setup.sh && pip install -r requirements.txt && python verify.py

What it checks, against the real tools/environments/tenki.py from
LuxorLabs/tenki-hermes-agent#1:

  1. Hermes' own backend gate accepts the tenki backend
  2. Sandbox creation + agent home detection (cwd "~" -> sandbox $HOME)
  3. Shell command roundtrip
  4. Exit codes propagate to the agent
  5. stderr is surfaced in output
  6. cwd is tracked across separate execute() calls
  7. File write + read back at the agent home
  8. stdin via heredoc mode (the bug the PR's 2nd commit fixed)
  9. Persistence: pause -> reattach by task_id -> filesystem intact

Costs two sandbox lifecycles (one ephemeral, one persistent+resumed) and
terminates both, including on failure.
"""

import sys
import traceback
import uuid

from hermes_env import bootstrap, require_credentials, terminate_task_sandboxes

require_credentials()
bootstrap()

from tools.environments.tenki import TenkiEnvironment, _task_tag  # noqa: E402
from tools.terminal_tool import check_terminal_requirements  # noqa: E402

FAILURES = []
CHECKS = 0


def check(label, actual, expected, match="eq"):
    """Assert and record. Never raises -- we want every failure, not the first."""
    global CHECKS
    CHECKS += 1
    if match == "eq":
        ok = actual == expected
    elif match == "in":
        ok = expected in actual
    elif match == "endswith":
        ok = str(actual).endswith(expected)
    else:
        raise ValueError(f"bad match mode {match!r}")

    if ok:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}")
        print(f"          expected ({match}): {expected!r}")
        print(f"          actual         : {actual!r}")
        FAILURES.append(label)
    return ok


def main():
    task_id = f"verify-{uuid.uuid4().hex[:8]}"
    p_task = f"{task_id}-p"
    # Outer safety net: whatever happens, never leave a billed VM running.
    try:
        return run_checks(task_id, p_task)
    finally:
        print("\nTerminating sandboxes...")
        for t in (task_id, p_task):
            try:
                print(f"  {t}: closed {terminate_task_sandboxes(t)}")
            except Exception as exc:
                print(f"  {t}: teardown error: {exc}")


def run_checks(task_id, p_task):
    print(f"Tenki x Hermes backend verification (task_id={task_id})\n")

    # -- 1. Hermes' own gate -------------------------------------------------
    # bootstrap() set TERMINAL_ENV=tenki. This is the real function that decides
    # whether the agent is even offered the terminal and file tools.
    print("[1] Hermes backend gate")
    check("check_terminal_requirements() accepts tenki",
          check_terminal_requirements(), True)
    check("task tag format", _task_tag(task_id), f"hermes-{task_id}".lower())

    # -- ephemeral sandbox ---------------------------------------------------
    print("\n[2] Creating sandbox (persistent_filesystem=False)")
    env = TenkiEnvironment(
        cwd="~", timeout=120, cpu=1, memory=2048, disk=10240,
        persistent_filesystem=False, task_id=task_id,
    )
    try:
        print(f"  sandbox id: {env._sandbox.id}")
        # cwd "~" is in _HOME_ALIASES, so the backend rewrites it to the
        # detected sandbox $HOME. Agent-visible cwd must be the guest's home.
        check("cwd '~' resolved to sandbox home", env.cwd, "/home/tenki")

        print("\n[3] Shell command roundtrip")
        r = env.execute("echo hello-from-tenki")
        check("returncode", r["returncode"], 0)
        check("stdout", r["output"], "hello-from-tenki", match="in")

        print("\n[4] Exit code propagation")
        check("exit 7 -> returncode 7", env.execute("exit 7")["returncode"], 7)
        check("exit 0 -> returncode 0", env.execute("true")["returncode"], 0)

        print("\n[5] stderr surfaces in output")
        check("stderr text present",
              env.execute("echo oops >&2")["output"], "oops", match="in")

        print("\n[6] cwd tracked across execute() calls")
        env.execute("mkdir -p sub && cd sub")
        check("pwd after cd", env.execute("pwd")["output"].strip(), "/sub",
              match="endswith")

        print("\n[7] File write + read at agent home")
        env.execute("echo persisted > /home/tenki/note.txt")
        check("file contents", env.execute("cat /home/tenki/note.txt")["output"],
              "persisted", match="in")
        check("file is really on the guest fs",
              env.execute("test -f /home/tenki/note.txt")["returncode"], 0)

        print("\n[8] stdin (heredoc mode)")
        check("backend declares heredoc stdin", TenkiEnvironment._stdin_mode,
              "heredoc")
        payload = "line-one\nline-two\n"
        w = env.execute("cat > /home/tenki/stdin.txt", stdin_data=payload)
        check("write via stdin returncode", w["returncode"], 0)
        back = env.execute("cat /home/tenki/stdin.txt")["output"]
        # Regression guard for the PR's 2nd commit: the heredoc used to bind to
        # the trailing trap instead of the mid-script cat, writing EMPTY files.
        check("stdin content round-tripped (not empty)", back, "line-one",
              match="in")
        check("stdin content complete", back, "line-two", match="in")
        # Heredoc-mode stdin is NOT byte-exact. The backend embeds stdin as a
        # shell heredoc (base.py::_embed_stdin_heredoc), and a heredoc always
        # delivers its body with a trailing newline -- so the file lands exactly
        # one byte longer than the payload (verified live: 18-byte payload -> 19
        # bytes on disk). This is inherent to heredoc stdin and shared by every
        # heredoc backend (Modal, Daytona), not a Tenki quirk. Assert it exactly:
        # content integrity is checked above, and this still catches the
        # empty-file / doubled-content regressions the PR's 2nd commit fixed.
        check("byte count = payload + 1 trailing newline (heredoc)",
              env.execute("wc -c < /home/tenki/stdin.txt")["output"].strip(),
              str(len(payload) + 1))
    finally:
        env.cleanup()  # ephemeral -> sandbox.close()

    # -- persistence roundtrip ----------------------------------------------
    print("\n[9] Persistence: pause -> reattach -> resume")
    p1 = TenkiEnvironment(
        cwd="~", timeout=120, cpu=1, memory=2048, disk=10240,
        persistent_filesystem=True, task_id=p_task,
    )
    try:
        first_id = p1._sandbox.id
        print(f"  created  {first_id}")
        p1.execute("echo survives-a-pause > /home/tenki/persistent.txt")
        check("wrote marker before pause",
              p1.execute("cat /home/tenki/persistent.txt")["output"],
              "survives-a-pause", match="in")
    finally:
        p1.cleanup()  # persistent -> sandbox.pause(), filesystem kept
    print("  paused")

    p2 = TenkiEnvironment(
        cwd="~", timeout=120, cpu=1, memory=2048, disk=10240,
        persistent_filesystem=True, task_id=p_task,
    )
    try:
        print(f"  reattached {p2._sandbox.id}")
        check("resumed the SAME sandbox (not a new one)", p2._sandbox.id, first_id)
        check("filesystem survived the pause",
              p2.execute("cat /home/tenki/persistent.txt")["output"],
              "survives-a-pause", match="in")
    finally:
        p2.cleanup()

    # -- verdict -------------------------------------------------------------
    print("\n" + "=" * 60)
    if FAILURES:
        print(f"FAILED: {len(FAILURES)}/{CHECKS} checks failed")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"OK: all {CHECKS} checks passed")
    return 0


def explain(exc: Exception) -> str | None:
    """Turn the two common setup failures into actionable guidance."""
    text = str(exc)
    if "unauthorized" in text.lower():
        return ("Tenki rejected the credential. Check TENKI_API_KEY (tk_...) "
                "or TENKI_AUTH_TOKEN.")
    if "multiple projects available" in text:
        return ("Your credential maps to several projects. Set TENKI_PROJECT_ID "
                "to one of the proj_... ids listed above.")
    if "no projects available" in text:
        return "Create a project in the Tenki dashboard, then set TENKI_PROJECT_ID."
    if "terminal.tenki" in text and "0.3.1" in text:
        return ("The PR pins tenki-sandbox==0.3.1, which is not on PyPI. "
                "Re-run ./setup.sh -- it repins to a published version.")
    return None


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:
        traceback.print_exc()
        hint = explain(exc)
        print("\nFAILED: verification raised before completing", file=sys.stderr)
        if hint:
            print(f"Hint: {hint}", file=sys.stderr)
        sys.exit(1)
