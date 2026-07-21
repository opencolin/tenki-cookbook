import os
from tenki_sandbox import Sandbox


def cfg(key):
    try:
        with open(os.path.expanduser("~/.config/tenki/config.yaml")) as f:
            for line in f:
                if line.startswith(key + ":"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return ""


os.environ.setdefault("TENKI_AUTH_TOKEN", cfg("auth_token"))
kw = {}
if cfg("current_project_id"):
    kw["project_id"] = cfg("current_project_id")
if cfg("current_workspace_id"):
    kw["workspace_id"] = cfg("current_workspace_id")

with Sandbox.create(cpu_cores=1, memory_mb=1024, **kw) as sb:
    r = sb.exec("python3", "-c", "print(6 * 7)")
    print("exec ->", repr(r.stdout_text.strip()), "exit", r.exit_code)
