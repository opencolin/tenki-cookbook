"""Run Hermes Agent's shell tool inside a Tenki microVM.

This drives the REAL backend: tools/environments/tenki.py from
LuxorLabs/tenki-hermes-agent#1, imported from a local checkout of the PR branch.
Nothing here is a reimplementation -- TenkiEnvironment and BaseEnvironment.execute()
are exactly what the agent calls when terminal.backend is "tenki".

    export TENKI_API_KEY=tk_...
    ./setup.sh && pip install -r requirements.txt && python main.py

No model/LLM key needed: we exercise the terminal backend, not the agent loop.
"""

import uuid

from hermes_env import bootstrap, require_credentials, terminate_task_sandboxes

require_credentials()
bootstrap()  # must run before importing anything under tools/

from tools.environments.tenki import TenkiEnvironment  # noqa: E402


def show(env, command, **kw):
    """Call the same entry point Hermes' terminal tool calls."""
    result = env.execute(command, **kw)
    print(f"\n$ {command}")
    print(f"  exit {result['returncode']}: {result['output'].strip()}")
    return result


def main():
    # task_id keys the sandbox tag (hermes-<task_id>) that persistence uses.
    task_id = f"cookbook-{uuid.uuid4().hex[:8]}"
    print(f"Task id: {task_id}")
    print("Creating sandbox (Firecracker microVM, boots in ~2s)...")

    # Same constructor the factory in tools/terminal_tool.py calls for
    # env_type == "tenki". persistent_filesystem=True is the Hermes default:
    # cleanup() pauses instead of destroying, so the next session resumes
    # the same filesystem.
    env = TenkiEnvironment(
        cwd="~",                     # remapped onto the detected sandbox $HOME
        timeout=120,
        cpu=1,
        memory=2048,                 # MB
        disk=10240,                  # MB -> the backend converts to 10 GB
        persistent_filesystem=True,
        task_id=task_id,
    )

    try:
        print(f"Sandbox: {env._sandbox.id}")
        print(f"Agent home resolved to: {env.cwd}")

        # 1. A plain shell command.
        show(env, "echo hello-from-tenki")

        # 2. Where am I? The agent is told about the sandbox, not your laptop.
        show(env, "uname -srm && whoami")

        # 3. Exit codes propagate, so the agent can tell success from failure.
        show(env, "exit 7")

        # 4. stderr is merged into output so the agent sees error text.
        show(env, "echo 'something broke' >&2")

        # 5. cwd is tracked across separate execute() calls by BaseEnvironment.
        show(env, "mkdir -p project && cd project")
        show(env, "pwd")

        # 6. Write and read a file at the agent home.
        show(env, "echo 'notes from the agent' > /home/tenki/notes.txt")
        show(env, "cat /home/tenki/notes.txt")

        # 7. stdin. The Tenki backend is _stdin_mode = "heredoc": stdin is
        #    embedded as a heredoc rather than piped.
        show(env, "cat > /home/tenki/via-stdin.txt", stdin_data="written over stdin\n")
        show(env, "cat /home/tenki/via-stdin.txt")

    finally:
        # Persistent backend -> pauses the sandbox, keeping the filesystem.
        print("\nPausing sandbox (filesystem preserved)...")
        env.cleanup()

    # Resume: a new environment with the SAME task_id reattaches via
    # client.list(tags=["hermes-<task_id>"]) and resumes the paused microVM.
    try:
        print("\nReattaching with the same task_id...")
        env2 = TenkiEnvironment(
            cwd="~", timeout=120, cpu=1, memory=2048, disk=10240,
            persistent_filesystem=True, task_id=task_id,
        )
        try:
            print(f"Sandbox: {env2._sandbox.id}  (same id = resumed, not recreated)")
            show(env2, "cat /home/tenki/notes.txt")
            show(env2, "cat /home/tenki/via-stdin.txt")
        finally:
            env2.cleanup()
    finally:
        # cleanup() only pauses. Terminate for real so nothing is left billing.
        # In an outer finally so it also runs if reattach/env2 raises -- otherwise
        # the paused microVM from env.cleanup() above would be left billing.
        print("\nTerminating...")
        print(f"  closed {terminate_task_sandboxes(task_id)} sandbox(es)")


if __name__ == "__main__":
    main()
