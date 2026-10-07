"""ML Prediction Service for FocusSense AI (Task 11).

Loads scikit-learn model artifacts and metadata persisted by ml/train.py,
validates feature vectors, and generates real ML inferences.
"""

import json
import sys
from pathlib import Path
from typing import Any

# Ensure project root is in sys.path so `ml` package can be imported
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import joblib
import numpy as np

from ml.features.feature_pipeline import FEATURE_NAMES, prepare_feature_dataframe

# Singleton cache for model artifacts
_MODEL_CACHE: dict[str, Any] | None = None


def get_artifacts_dir() -> Path:
    """Return path to stored ML artifacts directory."""
    # Project root is 3 levels up from backend/app/services/
    root_dir = Path(__file__).parent.parent.parent.parent
    return root_dir / "ml" / "models" / "artifacts"


def load_ml_artifacts(force_reload: bool = False) -> dict[str, Any]:
    """Load model artifacts, scaler, and version metadata."""
    global _MODEL_CACHE
    if _MODEL_CACHE is not None and not force_reload:
        return _MODEL_CACHE

    artifacts_dir = get_artifacts_dir()
    focus_path = artifacts_dir / "focus_regressor.joblib"
    distraction_path = artifacts_dir / "distraction_classifier.joblib"
    performance_path = artifacts_dir / "performance_regressor.joblib"
    preprocessor_path = artifacts_dir / "preprocessor.joblib"
    metadata_path = artifacts_dir / "metadata.json"

    if not (
        focus_path.exists()
        and distraction_path.exists()
        and performance_path.exists()
        and preprocessor_path.exists()
    ):
        raise RuntimeError(
            "ML model artifacts missing. Execute 'python ml/train.py' to train and persist models."
        )

    focus_model = joblib.load(focus_path)
    distraction_model = joblib.load(distraction_path)
    performance_model = joblib.load(performance_path)
    preprocessor = joblib.load(preprocessor_path)

    metadata = {}
    if metadata_path.exists():
        with open(metadata_path, encoding="utf-8") as f:
            metadata = json.load(f)

    _MODEL_CACHE = {
        "focus_model": focus_model,
        "distraction_model": distraction_model,
        "performance_model": performance_model,
        "preprocessor": preprocessor,
        "metadata": metadata,
        "model_version": metadata.get("model_version", "v1.0"),
    }
    return _MODEL_CACHE


def predict_behaviour(raw_features: dict[str, Any]) -> dict[str, Any]:
    """Generate real ML predictions from a raw behavioural feature dictionary.

    Returns clipped focus score (0-100), distraction level (LOW/MEDIUM/HIGH),
    and clipped performance score (0-100).
    """
    artifacts = load_ml_artifacts()
    preprocessor = artifacts["preprocessor"]
    focus_model = artifacts["focus_model"]
    distraction_model = artifacts["distraction_model"]
    performance_model = artifacts["performance_model"]
    version = artifacts["model_version"]

    # Prepare single-row DataFrame ensuring exact feature ordering
    df_features = prepare_feature_dataframe(raw_features)
    X_scaled = preprocessor.transform(df_features)

    # 1. Focus Score Regression (Clipped 0-100)
    raw_focus = float(focus_model.predict(X_scaled)[0])
    focus_score = round(float(np.clip(raw_focus, 0.0, 100.0)), 1)

    # 2. Distraction Level Classification (LOW, MEDIUM, HIGH)
    distraction_level = str(distraction_model.predict(X_scaled)[0])
    if distraction_level not in ("LOW", "MEDIUM", "HIGH"):
        raise ValueError(f"Invalid distraction class predicted: {distraction_level}")

    # 3. Performance Score Regression (Clipped 0-100)
    raw_perf = float(performance_model.predict(X_scaled)[0])
    performance_prediction = round(float(np.clip(raw_perf, 0.0, 100.0)), 1)

    return {
        "focus_score": focus_score,
        "distraction_level": distraction_level,
        "performance_prediction": performance_prediction,
        "model_version": version,
    }

