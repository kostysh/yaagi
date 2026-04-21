import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

PORT = int(os.environ.get("VLLM_FAST_PORT", "8000"))
MANIFEST_PATH = Path(
    os.environ.get("VLLM_FAST_MANIFEST_PATH", "/seed/models/base/vllm-fast-manifest.json")
)
MODELS_ROOT = Path(os.environ.get("VLLM_FAST_RUNTIME_MODELS_ROOT", "/models"))
OVERRIDE_CANDIDATE_ID = os.environ.get("VLLM_FAST_SELECTED_CANDIDATE_ID", "").strip()
HF_TOKEN_FILE = os.environ.get("YAAGI_HF_TOKEN_FILE", "").strip()


def load_hf_token() -> str | None:
    if HF_TOKEN_FILE:
        token_path = Path(HF_TOKEN_FILE)
        if token_path.exists():
            token = token_path.read_text(encoding="utf-8").strip()
            if token:
                return token

    token = (
        os.environ.get("YAAGI_HF_TOKEN", "").strip()
        or os.environ.get("HF_TOKEN", "").strip()
        or os.environ.get("HUGGINGFACE_HUB_TOKEN", "").strip()
    )
    return token or None


HF_TOKEN = load_hf_token()
ESSENTIAL_SNAPSHOT_FILES = (
    ".gitattributes",
    "README.md",
    "chat_template.jinja",
    "config.json",
    "generation_config.json",
    "model.safetensors",
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
)


def env_override(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


def override_int(name: str, default: int, minimum: int) -> int:
    raw_value = env_override(name)
    if raw_value is None:
        return default

    value = int(raw_value)
    if value < minimum:
        raise RuntimeError(f"{name} must be >= {minimum}, got {raw_value}")
    return value


def override_float(name: str, default: float, minimum_exclusive: float, maximum: float) -> float:
    raw_value = env_override(name)
    if raw_value is None:
        return default

    value = float(raw_value)
    if value <= minimum_exclusive or value > maximum:
        raise RuntimeError(
            f"{name} must be > {minimum_exclusive} and <= {maximum}, got {raw_value}"
        )
    return value


def override_bool(name: str, default: bool) -> bool:
    raw_value = env_override(name)
    if raw_value is None:
        return default

    normalized = raw_value.lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be a boolean string, got {raw_value}")


def copy_missing_tree(source_root: Path, target_root: Path) -> None:
    target_root.mkdir(parents=True, exist_ok=True)

    for source_entry in source_root.iterdir():
        target_entry = target_root / source_entry.name
        if source_entry.is_dir():
            copy_missing_tree(source_entry, target_entry)
            continue

        if target_entry.exists():
            continue

        target_entry.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_entry, target_entry)


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalize_relative_path(value: str, label: str) -> Path:
    normalized = Path(value)
    if normalized.is_absolute():
        raise RuntimeError(f"{label} must stay inside the runtime models root: {value}")
    if ".." in normalized.parts:
        raise RuntimeError(f"{label} must stay inside the runtime models root: {value}")
    return normalized


def resolve_selected_candidate(manifest: dict) -> dict:
    preferred_candidate_id = str(manifest.get("preferredCandidateId", "")).strip()
    if not preferred_candidate_id:
        raise RuntimeError("vllm-fast bootstrap requires preferredCandidateId")

    selected_candidate_id = str(manifest.get("selectedCandidateId", "")).strip()
    if not selected_candidate_id:
        raise RuntimeError(
            "vllm-fast bootstrap requires selectedCandidateId when selectionState=qualified"
        )
    if selected_candidate_id != preferred_candidate_id:
        raise RuntimeError(
            "vllm-fast bootstrap requires selectedCandidateId to match preferredCandidateId"
        )
    if OVERRIDE_CANDIDATE_ID and OVERRIDE_CANDIDATE_ID != selected_candidate_id:
        raise RuntimeError(
            "vllm-fast bootstrap override candidate must match selectedCandidateId"
        )

    for candidate in manifest["candidates"]:
        if candidate["candidateId"] == selected_candidate_id:
            return candidate
    raise RuntimeError(f"candidate {selected_candidate_id!r} is not declared in the manifest")


def ensure_manifest_is_qualified(manifest: dict) -> None:
    selection_state = str(manifest.get("selectionState", "")).strip()
    if selection_state != "qualified":
        raise RuntimeError(
            f"vllm-fast bootstrap requires selectionState=qualified, got {selection_state or 'missing'}"
        )


def resolve_serving_config(manifest: dict) -> dict:
    serving = manifest.get("servingConfig") or {}
    return {
        "servedModelName": serving.get("servedModelName", "phase-0-fast"),
        "dtype": serving.get("dtype", "bfloat16"),
        "tensorParallelSize": int(serving.get("tensorParallelSize", 1)),
        "maxModelLen": override_int(
            "VLLM_FAST_SERVING_MAX_MODEL_LEN", int(serving.get("maxModelLen", 16384)), 1
        ),
        "gpuMemoryUtilization": override_float(
            "VLLM_FAST_SERVING_GPU_MEMORY_UTILIZATION",
            float(serving.get("gpuMemoryUtilization", 0.82)),
            0.0,
            1.0,
        ),
        "maxNumSeqs": override_int(
            "VLLM_FAST_SERVING_MAX_NUM_SEQS", int(serving.get("maxNumSeqs", 4)), 1
        ),
        "generationConfig": serving.get("generationConfig", "vllm"),
        "attentionBackend": serving.get("attentionBackend"),
        "limitMmPerPrompt": serving.get("limitMmPerPrompt"),
        "enforceEager": override_bool(
            "VLLM_FAST_SERVING_ENFORCE_EAGER", bool(serving.get("enforceEager", False))
        ),
    }


def load_existing_materialization(materialization_path: Path) -> dict | None:
    if not materialization_path.exists():
        return None

    try:
        return json.loads(materialization_path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def has_incomplete_snapshot(snapshot_path: Path) -> bool:
    download_root = snapshot_path / ".cache" / "huggingface" / "download"
    if not download_root.exists():
        return False

    return any(download_root.glob("*.incomplete")) or any(download_root.glob("*.lock"))


def can_reuse_materialization(
    manifest: dict,
    candidate: dict,
    serving: dict,
    snapshot_path: Path,
    materialization_path: Path,
) -> bool:
    materialization = load_existing_materialization(materialization_path)
    if materialization is None:
        return False

    expected_pairs = {
        "serviceId": manifest["serviceId"],
        "candidateId": candidate["candidateId"],
        "modelId": candidate["modelId"],
        "snapshotPath": str(snapshot_path),
        "manifestSelectionState": manifest["selectionState"],
        "servedModelName": serving["servedModelName"],
    }
    for key, expected_value in expected_pairs.items():
        if materialization.get(key) != expected_value:
            return False

    if has_incomplete_snapshot(snapshot_path):
        return False

    return all((snapshot_path / relative_path).exists() for relative_path in ESSENTIAL_SNAPSHOT_FILES)


def materialize_candidate(manifest: dict, candidate: dict, serving: dict) -> tuple[Path, Path]:
    from huggingface_hub import snapshot_download

    seed_models_root = MANIFEST_PATH.parent.parent.resolve()
    copy_missing_tree(seed_models_root, MODELS_ROOT)

    runtime_root = (MODELS_ROOT / normalize_relative_path(manifest["runtimeArtifactRoot"], "runtimeArtifactRoot")).resolve()
    candidate_root = (MODELS_ROOT / normalize_relative_path(candidate["runtimeSubdir"], "runtimeSubdir")).resolve()

    if runtime_root not in candidate_root.parents and runtime_root != candidate_root:
        raise RuntimeError(
            f"candidate runtime path {candidate_root} escapes runtime root {runtime_root}"
        )

    runtime_root.mkdir(parents=True, exist_ok=True)
    candidate_root.mkdir(parents=True, exist_ok=True)
    snapshot_path = candidate_root / "snapshot"
    snapshot_path.mkdir(parents=True, exist_ok=True)
    materialization_path = candidate_root / "materialization.json"

    if can_reuse_materialization(manifest, candidate, serving, snapshot_path, materialization_path):
        print(
            json.dumps(
                {
                    "level": "info",
                    "message": "reusing previously materialized vllm-fast candidate",
                    "candidateId": candidate["candidateId"],
                    "modelId": candidate["modelId"],
                    "snapshotPath": str(snapshot_path),
                    "materializationPath": str(materialization_path),
                }
            ),
            flush=True,
        )
        return snapshot_path, materialization_path

    model_id = candidate["modelId"]
    print(
        json.dumps(
            {
                "level": "info",
                "message": "materializing vllm-fast candidate",
                "candidateId": candidate["candidateId"],
                "modelId": model_id,
                "snapshotPath": str(snapshot_path),
            }
        ),
        flush=True,
    )

    snapshot_download(
        repo_id=model_id,
        local_dir=str(snapshot_path),
        local_dir_use_symlinks=False,
        token=HF_TOKEN,
        resume_download=True,
    )

    materialization_path.write_text(
        json.dumps(
            {
                "serviceId": manifest["serviceId"],
                "candidateId": candidate["candidateId"],
                "modelId": model_id,
                "snapshotPath": str(snapshot_path),
                "manifestPath": str(MANIFEST_PATH),
                "manifestSelectionState": manifest["selectionState"],
                "servedModelName": serving["servedModelName"],
                "snapshotFiles": list(ESSENTIAL_SNAPSHOT_FILES),
                "materializedAt": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    return snapshot_path, materialization_path


def build_vllm_command(snapshot_path: Path, serving: dict) -> list[str]:
    command = [
        "vllm",
        "serve",
        str(snapshot_path),
        "--host",
        "0.0.0.0",
        "--port",
        str(PORT),
        "--served-model-name",
        serving["servedModelName"],
        "--dtype",
        serving["dtype"],
        "--tensor-parallel-size",
        str(serving["tensorParallelSize"]),
        "--max-model-len",
        str(serving["maxModelLen"]),
        "--gpu-memory-utilization",
        str(serving["gpuMemoryUtilization"]),
        "--max-num-seqs",
        str(serving["maxNumSeqs"]),
        "--generation-config",
        serving["generationConfig"],
    ]

    if isinstance(serving.get("attentionBackend"), str) and serving["attentionBackend"].strip():
        command.extend(["--attention-backend", serving["attentionBackend"].strip()])

    if isinstance(serving.get("limitMmPerPrompt"), str) and serving["limitMmPerPrompt"].strip():
        command.extend(["--limit-mm-per-prompt", serving["limitMmPerPrompt"].strip()])

    if serving.get("enforceEager"):
        command.append("--enforce-eager")

    return command


def main() -> None:
    manifest = load_manifest()
    ensure_manifest_is_qualified(manifest)
    candidate = resolve_selected_candidate(manifest)
    serving = resolve_serving_config(manifest)
    snapshot_path, materialization_path = materialize_candidate(manifest, candidate, serving)

    command = build_vllm_command(snapshot_path, serving)
    print(
        json.dumps(
            {
                "level": "info",
                "message": "starting vllm-fast serving",
                "candidateId": candidate["candidateId"],
                "modelId": candidate["modelId"],
                "servedModelName": serving["servedModelName"],
                "materializationPath": str(materialization_path),
                "command": command,
            }
        ),
        flush=True,
    )
    os.execvp(command[0], command)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "level": "error",
                    "message": "vllm-fast startup failed",
                    "detail": str(error),
                }
            ),
            file=sys.stderr,
            flush=True,
        )
        raise
