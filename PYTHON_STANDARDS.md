# Python Standards — Python 3.14 Compatibility

All Python projects under this factory must follow these standards.
Last updated: 2026-04-05

---

## Package Compatibility Table

These constraints apply to all Python 3.14 projects. Deviating from them will cause silent crashes or import errors that are hard to diagnose.

| Package | Required Version | Reason |
|---|---|---|
| `sqlalchemy` | `>=2.0.48` | Versions 2.0.30–2.0.47 crash with `TypeError: Can't replace canonical symbol for '__firstlineno__'` on Python 3.14. |
| `bcrypt` | `<4.0.0` | bcrypt 4.x removes the `__about__` attribute, breaking `passlib 1.7.4` which reads `bcrypt.__about__.__version__`. Use `bcrypt==3.2.2`. |
| `openai-whisper` | `==20250625` | Latest release with Python 3.14 support. Must install with `--no-build-isolation` (see pip rules below). |
| `Pillow` | `>=11.0.0` | Older versions crash with `KeyError: __version__` on Python 3.14. Must install with `--no-build-isolation`. |
| `setuptools` | `>=75.0.0` | Must appear at the top of `requirements.txt`. Required for `--no-build-isolation` to resolve build backends correctly. |
| `pytest` | `>=8.0.0` | Must be explicitly listed in `requirements.txt`. Not assumed to be present. |
| `pytest-asyncio` | `>=0.23.0` | Pair with `asyncio_mode = auto` in `pytest.ini`. Versions below 0.23 do not support this mode flag. |
| `httpx` | `==0.28.1` | httpx 0.27.x pulls `httpcore==1.0.9` as a dependency, which crashes on Python 3.14 (see httpcore patch section below). Pin to 0.28.1 which ships a compatible httpcore. |
| `aiomysql` | `==0.3.2` | Earlier versions have async compatibility issues with Python 3.14's updated coroutine handling. |

---

## httpcore Python 3.14 Patch

### Problem

`httpcore 1.0.9` crashes on Python 3.14 with:

```
AttributeError: cannot set '__module__' attribute of immutable type 'Union'
```

### Root Cause

The loop at the bottom of `httpcore/__init__.py` iterates over all exported names and calls:

```python
setattr(obj, "__module__", "httpcore")
```

Python 3.14 forbids setting `__module__` on special typing forms such as `typing.Union`. No try/except wraps this call in the original code, so the import fails unconditionally.

### Fix

Wrap the `setattr` call in `try/except (AttributeError, TypeError): pass`.

### Critical: Two Patch Locations

httpcore may be installed at **two separate locations** simultaneously. Both must be patched or the import will still fail:

1. **Inside the project venv** (primary):
   ```
   <project-root>/venv/Lib/site-packages/httpcore/__init__.py
   ```

2. **System-level user site-packages** (secondary — often overlooked):
   ```
   C:\Users\<username>\AppData\Roaming\Python\Python314\site-packages\httpcore\__init__.py
   ```

If only the venv copy is patched and the system copy is on `sys.path`, the crash may still occur depending on import resolution order.

### fix_httpcore.py

Place this script at `scripts/fix_httpcore.py`. It is idempotent — safe to run multiple times.

```python
#!/usr/bin/env python3
"""
Patch httpcore __init__.py for Python 3.14 compatibility.
Wraps the setattr(__module__) loop in try/except to handle immutable typing forms.
Patches both the venv copy and the user site-packages copy if present.
Idempotent: running multiple times has no effect after first application.
"""
import sys
import os
import site

SENTINEL = "# patched-for-py314"

PATCH_SEARCH = "setattr(obj, \"__module__\", __name__)"
PATCH_REPLACE = (
    "try:  # patched-for-py314\n"
    "            setattr(obj, \"__module__\", __name__)\n"
    "        except (AttributeError, TypeError):  # patched-for-py314\n"
    "            pass  # patched-for-py314"
)

PATCH_SEARCH_ALT = "setattr(obj, '__module__', __name__)"
PATCH_REPLACE_ALT = (
    "try:  # patched-for-py314\n"
    "            setattr(obj, '__module__', __name__)\n"
    "        except (AttributeError, TypeError):  # patched-for-py314\n"
    "            pass  # patched-for-py314"
)


def find_httpcore_paths():
    """Return all candidate httpcore __init__.py paths."""
    candidates = []

    # 1. venv (relative to this script's project root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    venv_path = os.path.join(
        project_root, "venv", "Lib", "site-packages", "httpcore", "__init__.py"
    )
    candidates.append(venv_path)

    # 2. User site-packages (system-level Python 3.14 user install)
    for sp in site.getusersitepackages() if isinstance(site.getusersitepackages(), list) else [site.getusersitepackages()]:
        candidates.append(os.path.join(sp, "httpcore", "__init__.py"))

    # 3. All sys.path entries
    for p in sys.path:
        candidates.append(os.path.join(p, "httpcore", "__init__.py"))

    # Deduplicate while preserving order
    seen = set()
    result = []
    for c in candidates:
        c = os.path.normpath(c)
        if c not in seen:
            seen.add(c)
            result.append(c)
    return result


def patch_file(path):
    if not os.path.isfile(path):
        return "NOT_FOUND"

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if SENTINEL in content:
        return "ALREADY_PATCHED"

    if PATCH_SEARCH in content:
        content = content.replace(PATCH_SEARCH, PATCH_REPLACE)
    elif PATCH_SEARCH_ALT in content:
        content = content.replace(PATCH_SEARCH_ALT, PATCH_REPLACE_ALT)
    else:
        return "PATTERN_NOT_FOUND"

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return "PATCHED"


def main():
    paths = find_httpcore_paths()
    any_patched = False
    any_found = False

    for path in paths:
        result = patch_file(path)
        if result == "NOT_FOUND":
            continue
        any_found = True
        status = {
            "PATCHED": "[PATCHED]",
            "ALREADY_PATCHED": "[SKIP] already patched",
            "PATTERN_NOT_FOUND": "[WARN] file found but patch pattern not matched — check httpcore version",
        }.get(result, f"[?] {result}")
        print(f"  {status}: {path}")
        if result == "PATCHED":
            any_patched = True

    if not any_found:
        print("[INFO] httpcore not found at any expected location — nothing to patch")
        print("       This is fine if httpcore is not installed yet.")
        return

    if any_patched:
        print("[OK] httpcore patched successfully for Python 3.14")
    else:
        print("[OK] httpcore already patched — no changes needed")


if __name__ == "__main__":
    main()
```

### When to Run

`start.ps1` must call `python scripts/fix_httpcore.py` immediately after `pip install -r requirements.txt` and before starting the server. `fix_httpcore.py` is committed to the repository (it is not a generated artifact).

---

## pip Rules

1. **Always use `python -m pip`** — never bare `pip`. Bare `pip` may resolve to a different Python version on Windows.

2. **Always use the Tsinghua mirror**:
   ```
   python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

3. **Use `--no-build-isolation` for packages that require it**:
   ```
   python -m pip install openai-whisper==20250625 --no-build-isolation -i https://pypi.tuna.tsinghua.edu.cn/simple
   python -m pip install "Pillow>=11.0.0" --no-build-isolation -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```
   These packages require access to the already-installed `setuptools` during their build step. `--no-build-isolation` allows the build to use the environment's existing `setuptools` instead of fetching a fresh isolated copy.

4. **Install `setuptools` before other packages** when using `--no-build-isolation`:
   ```
   python -m pip install "setuptools>=75.0.0" -i https://pypi.tuna.tsinghua.edu.cn/simple
   python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

---

## uvicorn Rules (Windows + Python 3.14)

### NEVER use `--reload`

`uvicorn app.main:app --reload` uses `watchfiles` which relies on file system events via a Rust extension. On Python 3.14, this extension frequently crashes the worker process silently, causing the server to appear to start but serve nothing. The symptom is a server that starts without error but returns `text/plain: Internal Server Error` on every request.

**Correct command:**
```
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Do not use:
```
uvicorn app.main:app --reload          # WRONG: causes silent crashes on Python 3.14
uvicorn app.main:app                   # WRONG: bare uvicorn may miss venv
```

After any code change during development, stop the process (`Ctrl+C`) and restart with the correct command. `start.ps1` handles this automatically.

---

## Diagnosing `text/plain: Internal Server Error`

When the server returns a `Content-Type: text/plain` response body of `Internal Server Error` with no detail, the uvicorn worker has crashed at import time or at request time. The HTTP response body is generated by uvicorn's bare exception handler — the application never ran.

**Diagnostic command — run this before anything else:**
```
python -c "from app.main import app"
```

Run this from the project's `backend/` directory with the venv activated. If the import fails, the full traceback appears here. Common causes:
- Missing environment variable (`.env` not loaded, `os.environ["KEY"]` raises `KeyError`)
- Package import error (missing dep, version incompatibility, httpcore not patched)
- SQLAlchemy model registration error (wrong version constraint)
- Circular import in the application module tree

Fix the import error, then restart uvicorn. Never debug a worker crash from the HTTP response body alone.

---

## requirements.txt Template

The order of entries matters. `setuptools` must come first. `--no-build-isolation` packages are noted in comments; `start.ps1` installs them separately with the correct flag.

```
# ============================================================
# requirements.txt — Python 3.14 compatible
# Install order matters. Run start.ps1 to install correctly.
# ============================================================

# Build tools — must be installed first
setuptools>=75.0.0

# Web framework
fastapi==0.115.6
uvicorn==0.32.1

# Database (async)
sqlalchemy>=2.0.48
aiomysql==0.3.2

# Auth
passlib==1.7.4
bcrypt<4.0.0
python-jose[cryptography]==3.3.0
python-multipart==0.0.20

# HTTP client (pin to avoid httpcore 1.0.9 on Python 3.14)
httpx==0.28.1

# Config
python-dotenv==1.0.1

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0

# ============================================================
# Packages requiring --no-build-isolation — installed by
# start.ps1 separately AFTER the above. Do NOT install these
# with the bulk pip install command.
# ============================================================
# openai-whisper==20250625
# Pillow>=11.0.0
```

**Notes:**
- `openai-whisper` and `Pillow` are commented out of the main block because they require `--no-build-isolation`. `start.ps1` installs them in a separate step.
- After all packages are installed, `start.ps1` runs `scripts/fix_httpcore.py` to patch the httpcore `__init__.py`.
- `pytest.ini` must contain:
  ```ini
  [pytest]
  asyncio_mode = auto
  ```
