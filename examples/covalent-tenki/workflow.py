"""Run a Covalent workflow where each task executes in its own disposable Tenki
microVM (a fresh Linux VM with real root, created on demand, destroyed when the
task finishes).

Full run (needs a Covalent dispatcher):
    export TENKI_AUTH_TOKEN=tk_...     # a tk_ API key (see README for the session-token note)
    covalent start
    python workflow.py

Two things to know (both covered in the README):
  - `pip install -r requirements.txt` resolves to covalent 0.240.0 + requests
    2.34.x, the exact pair where *any* ct.dispatch() returns 422 -- an upstream
    Covalent bug, worked around inline below (the marked patch block).
  - cloudpickle needs matching minor versions, so this process's Python minor
    must equal the sandbox image's (3.12 on the default image).
"""
import covalent as ct

# --------------------------------------------------------------------------
# UPSTREAM COVALENT BUG WORKAROUND -- remove when upstream covalent/requests is
# fixed. With covalent==0.240.0 and requests>=2.34, the Covalent SDK posts the
# dispatch manifest as a raw string with no `Content-Type: application/json`
# header, so the dispatcher's FastAPI rejects every dispatch with 422
# Unprocessable Entity -- nothing to do with Tenki or the executor; without this
# you never even reach sandbox creation. From the plugin repo's README
# ("Known upstream issue"): https://github.com/TenkiCloud/covalent-tenki-plugin
from covalent._dispatcher_plugins import local as ldisp

_orig_post = ldisp.APIClient.post


def _patched_post(self, endpoint, **kw):
    if "data" in kw:
        kw.setdefault("headers", {})["Content-Type"] = "application/json"
    return _orig_post(self, endpoint, **kw)


ldisp.APIClient.post = _patched_post
# --------------------------- end workaround -------------------------------

from covalent_tenki_plugin import TenkiExecutor  # noqa: E402 -- after the patch

# Each electron assigned this executor runs in a fresh Tenki sandbox.
tenki = TenkiExecutor(cpu_cores=2, memory_mb=4096, sandbox_requirements="numpy")


@ct.electron(executor=tenki)
def sqrt_of_sum(n):
    import numpy as np  # installed in the VM via sandbox_requirements
    return float(np.sqrt(sum(range(n))))


@ct.lattice
def workflow(n):
    return sqrt_of_sum(n)


if __name__ == "__main__":
    dispatch_id = ct.dispatch(workflow)(100)
    print("dispatched:", dispatch_id)
    result = ct.get_result(dispatch_id, wait=True)
    print("result:", result.result)  # sqrt(sum(0..99)) = sqrt(4950) ~= 70.36
