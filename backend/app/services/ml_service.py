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


FEATURE_DISPLAY_NAMES: dict[str, str] = {
    "productive_activity_ratio": "Productive Ratio",
    "distraction_activity_ratio": "Distraction Ratio",
    "productive_duration": "Productive Duration",
    "distraction_duration": "Distraction Duration",
    "break_duration": "Break Duration",
    "total_session_duration": "Total Duration",
    "activity_switch_count": "Activity Switches",
    "activity_count": "Recorded Activities",
    "unique_application_count": "Unique Apps",
    "quiz_score": "Quiz Score",
}


def _tree_path_attribution_forest(model: Any, x: np.ndarray) -> tuple[float, np.ndarray]:
    """Calculate exact tree path feature attributions for a Random Forest Regressor.

    Decomposes the prediction into base_value + sum(contributions) = prediction.
    """
    n_features = len(x)
    contributions = np.zeros(n_features, dtype=float)
    base_values: list[float] = []

    for est in model.estimators_:
        tree = est.tree_
        node = 0
        base_values.append(float(tree.value[0, 0, 0]))
        while tree.children_left[node] != -1:
            feat = tree.feature[node]
            thresh = tree.threshold[node]
            curr_val = float(tree.value[node, 0, 0])
            if x[feat] <= thresh:
                next_node = tree.children_left[node]
            else:
                next_node = tree.children_right[node]
            next_val = float(tree.value[next_node, 0, 0])
            contributions[feat] += next_val - curr_val
            node = next_node

    base_value = float(np.mean(base_values))
    shap_arr = contributions / len(model.estimators_)
    return base_value, shap_arr


def _tree_path_attribution_gbr(model: Any, x: np.ndarray) -> tuple[float, np.ndarray]:
    """Calculate exact tree path feature attributions for GradientBoostingRegressor."""
    n_features = len(x)
    lr = float(getattr(model, "learning_rate", 1.0))
    if hasattr(model, "init_") and hasattr(model.init_, "predict"):
        init_val = float(model.init_.predict(x.reshape(1, -1))[0])
    else:
        init_val = 0.0

    contributions = np.zeros(n_features, dtype=float)
    for est in model.estimators_.ravel():
        tree = est.tree_
        node = 0
        while tree.children_left[node] != -1:
            feat = tree.feature[node]
            thresh = tree.threshold[node]
            curr_val = float(tree.value[node, 0, 0])
            if x[feat] <= thresh:
                next_node = tree.children_left[node]
            else:
                next_node = tree.children_right[node]
            next_val = float(tree.value[next_node, 0, 0])
            contributions[feat] += lr * (next_val - curr_val)
            node = next_node

    return init_val, contributions


def generate_attribution_summary(
    attributions: list[dict[str, Any]], target: str, prediction: float, base_value: float
) -> str:
    """Generate a readable, non-causal explanation of feature attributions."""
    positives = [a for a in attributions if a["attribution"] > 0.01]
    negatives = [a for a in attributions if a["attribution"] < -0.01]

    target_display = target.replace("_", " ").title()
    parts = []

    if positives:
        top_pos = positives[0]
        parts.append(
            f"{top_pos['display_name']} had the strongest positive contribution (+{top_pos['attribution']} pts)"
        )
    if negatives:
        top_neg = negatives[0]
        parts.append(
            f"{top_neg['display_name']} had the primary reducing effect ({top_neg['attribution']} pts)"
        )

    net_delta = round(prediction - base_value, 1)
    sign = "+" if net_delta >= 0 else ""
    parts.append(
        f"projecting a {target_display} of {prediction} ({sign}{net_delta} relative to baseline {base_value})"
    )

    return "; ".join(parts) + "."


def calculate_feature_attributions(
    raw_features: dict[str, Any], target: str = "focus_score"
) -> dict[str, Any] | None:
    """Calculate real, validated feature attributions for a behavioural feature snapshot.

    Uses SHAP TreeExplainer if the `shap` package is available, or an exact native
    tree decision path decomposition for compatible scikit-learn tree ensembles.
    Guarantees efficiency: base_value + sum(attributions) == prediction.
    Safely returns None for non-tree models, invalid/missing inputs, or non-finite vectors.
    """
    if not isinstance(raw_features, dict) or not raw_features:
        return None

    # Gating: must have positive duration or activity count to explain a real session
    total_duration = float(raw_features.get("total_session_duration") or 0.0)
    activity_count = int(raw_features.get("activity_count") or 0)
    if total_duration <= 0.0 and activity_count <= 0:
        return None

    artifacts = load_ml_artifacts()
    preprocessor = artifacts["preprocessor"]

    if target == "focus_score":
        model = artifacts["focus_model"]
    elif target == "performance_score":
        model = artifacts["performance_model"]
    else:
        raise ValueError(f"Unsupported explanation target: {target}")

    # Check model compatibility
    is_rf = hasattr(model, "estimators_") and not hasattr(model, "learning_rate")
    is_gbr = hasattr(model, "estimators_") and hasattr(model, "learning_rate")
    if not (is_rf or is_gbr):
        # Model is not a compatible tree ensemble
        return None

    try:
        df_features = prepare_feature_dataframe(raw_features)
        X_scaled = preprocessor.transform(df_features)

        # Validate finite values
        if not np.all(np.isfinite(X_scaled)):
            return None

        raw_pred = float(model.predict(X_scaled)[0])
        x = X_scaled[0]

        # Attempt external SHAP library first if available
        method = "tree_path_attribution"
        base_value: float | None = None
        shap_arr: np.ndarray | None = None

        try:
            import shap  # type: ignore[import-untyped]

            explainer = shap.TreeExplainer(model)
            shap_raw = explainer.shap_values(X_scaled)
            shap_arr = np.array(shap_raw).squeeze()
            base_value = float(np.array(explainer.expected_value).squeeze())
            method = "shap_tree_explainer"
        except (ImportError, Exception):
            # Fall back to faithful native tree path attribution
            if is_rf:
                base_value, shap_arr = _tree_path_attribution_forest(model, x)
            elif is_gbr:
                base_value, shap_arr = _tree_path_attribution_gbr(model, x)

        if base_value is None or shap_arr is None:
            return None

        # Verify finite numbers
        if not np.all(np.isfinite(shap_arr)) or not np.isfinite(base_value):
            return None

        # Build feature attribution records
        attributions: list[dict[str, Any]] = []
        values_dict: dict[str, float] = {}

        for feat_name, attr_val in zip(FEATURE_NAMES, shap_arr):
            attr_round = round(float(attr_val), 3)
            feat_val = raw_features.get(feat_name)
            values_dict[feat_name] = attr_round
            attributions.append(
                {
                    "feature_name": feat_name,
                    "display_name": FEATURE_DISPLAY_NAMES.get(feat_name, feat_name),
                    "feature_value": feat_val,
                    "attribution": attr_round,
                    "impact": (
                        "positive"
                        if attr_round > 0.005
                        else ("negative" if attr_round < -0.005 else "neutral")
                    ),
                }
            )

        # Sort features by absolute attribution magnitude descending
        attributions.sort(key=lambda item: abs(item["attribution"]), reverse=True)

        pred_rounded = round(raw_pred, 1)
        base_rounded = round(base_value, 1)

        return {
            "target": target,
            "model_name": type(model).__name__,
            "model_version": artifacts["model_version"],
            "base_value": base_rounded,
            "prediction": pred_rounded,
            "method": method,
            "values": values_dict,
            "attributions": attributions,
            "summary": generate_attribution_summary(
                attributions, target, pred_rounded, base_rounded
            ),
        }
    except Exception:
        # Graceful failure on any unexpected calculation error
        return None


COUNTERFACTUAL_BOUNDS: dict[str, dict[str, float | int]] = {
    "productive_duration": {"min": 0.0, "max": 86400.0},
    "distraction_duration": {"min": 0.0, "max": 86400.0},
    "break_duration": {"min": 0.0, "max": 86400.0},
    "activity_switch_count": {"min": 0, "max": 500},
    "unique_application_count": {"min": 1, "max": 100},
}


def simulate_counterfactual(
    baseline_features: dict[str, Any], adjustments: dict[str, Any]
) -> dict[str, Any]:
    """Run a bounded hypothetical what-if simulation using the existing ML models.

    Preserves mathematical consistency between durations and activity ratios,
    reruns the exact trained scikit-learn models, and returns baseline vs.
    simulated predictions, deltas, and a concise non-causal explanation.
    """
    base_total = float(baseline_features.get("total_session_duration") or 0.0)
    base_count = int(baseline_features.get("activity_count") or 0)
    if base_total <= 0.0 or base_count < 1:
        raise ValueError(
            "Baseline session lacks sufficient activity telemetry for counterfactual simulation."
        )

    base_prod = float(baseline_features.get("productive_duration") or 0.0)
    base_dist = float(baseline_features.get("distraction_duration") or 0.0)
    base_break = float(baseline_features.get("break_duration") or 0.0)
    base_switches = int(baseline_features.get("activity_switch_count") or 0)
    base_apps = max(1, int(baseline_features.get("unique_application_count") or 1))
    other_dur = max(0.0, base_total - (base_prod + base_dist + base_break))

    new_prod = (
        float(adjustments["productive_duration"])
        if adjustments.get("productive_duration") is not None
        else base_prod
    )
    new_dist = (
        float(adjustments["distraction_duration"])
        if adjustments.get("distraction_duration") is not None
        else base_dist
    )
    new_break = (
        float(adjustments["break_duration"])
        if adjustments.get("break_duration") is not None
        else base_break
    )
    new_switches = (
        int(adjustments["activity_switch_count"])
        if adjustments.get("activity_switch_count") is not None
        else base_switches
    )
    new_apps = (
        int(adjustments["unique_application_count"])
        if adjustments.get("unique_application_count") is not None
        else base_apps
    )

    if new_prod < 0.0 or new_dist < 0.0 or new_break < 0.0:
        raise ValueError("Simulated durations cannot be negative.")
    if new_switches < 0 or new_apps < 1:
        raise ValueError("Invalid activity switch count or unique application count.")

    new_total = round(new_prod + new_dist + new_break + other_dur, 1)
    if new_total <= 0.0:
        raise ValueError("Simulated total session duration must be greater than 0 seconds.")

    new_prod_ratio = round(new_prod / new_total, 4)
    new_dist_ratio = round(new_dist / new_total, 4)

    modified_features: dict[str, Any] = {
        "total_session_duration": new_total,
        "productive_duration": round(new_prod, 1),
        "distraction_duration": round(new_dist, 1),
        "break_duration": round(new_break, 1),
        "productive_activity_ratio": new_prod_ratio,
        "distraction_activity_ratio": new_dist_ratio,
        "activity_switch_count": new_switches,
        "activity_count": base_count,
        "unique_application_count": new_apps,
        "quiz_score": baseline_features.get("quiz_score"),
    }

    baseline_preds = predict_behaviour(baseline_features)
    simulated_preds = predict_behaviour(modified_features)

    focus_delta = round(simulated_preds["focus_score"] - baseline_preds["focus_score"], 1)
    perf_delta = round(
        simulated_preds["performance_prediction"] - baseline_preds["performance_prediction"],
        1,
    )
    distraction_changed = (
        simulated_preds["distraction_level"] != baseline_preds["distraction_level"]
    )

    changes_desc: list[str] = []
    if round(new_prod, 1) != round(base_prod, 1):
        changes_desc.append(
            f"productive time from {round(base_prod / 60, 1)}m to {round(new_prod / 60, 1)}m"
        )
    if round(new_dist, 1) != round(base_dist, 1):
        changes_desc.append(
            f"distraction time from {round(base_dist / 60, 1)}m to {round(new_dist / 60, 1)}m"
        )
    if round(new_break, 1) != round(base_break, 1):
        changes_desc.append(
            f"break time from {round(base_break / 60, 1)}m to {round(new_break / 60, 1)}m"
        )
    if new_switches != base_switches:
        changes_desc.append(f"activity switches from {base_switches} to {new_switches}")
    if new_apps != base_apps:
        changes_desc.append(f"unique applications from {base_apps} to {new_apps}")

    focus_sign = "+" if focus_delta >= 0 else ""
    perf_sign = "+" if perf_delta >= 0 else ""

    if not changes_desc:
        explanation_summary = (
            "Hypothetical simulation inputs match the observed session baseline; "
            f"projected focus score remains {simulated_preds['focus_score']} "
            f"and distraction level remains {simulated_preds['distraction_level']}."
        )
    else:
        joined_changes = ", ".join(changes_desc)
        explanation_summary = (
            f"In this hypothetical what-if simulation, adjusting {joined_changes} "
            f"shifts the model-projected focus score from {baseline_preds['focus_score']} "
            f"to {simulated_preds['focus_score']} ({focus_sign}{focus_delta} pts), "
            f"distraction level from {baseline_preds['distraction_level']} to "
            f"{simulated_preds['distraction_level']}, and projected performance score "
            f"from {baseline_preds['performance_prediction']}% to "
            f"{simulated_preds['performance_prediction']}% ({perf_sign}{perf_delta}%). "
            "These are hypothetical model projections, not measured session outcomes."
        )

    return {
        "model_version": simulated_preds["model_version"],
        "allowed_bounds": COUNTERFACTUAL_BOUNDS,
        "baseline_features": dict(baseline_features),
        "modified_features": modified_features,
        "baseline_predictions": {
            "focus_score": baseline_preds["focus_score"],
            "distraction_level": baseline_preds["distraction_level"],
            "performance_prediction": baseline_preds["performance_prediction"],
        },
        "simulated_predictions": {
            "focus_score": simulated_preds["focus_score"],
            "distraction_level": simulated_preds["distraction_level"],
            "performance_prediction": simulated_preds["performance_prediction"],
        },
        "deltas": {
            "focus_score_delta": focus_delta,
            "performance_prediction_delta": perf_delta,
            "distraction_level_changed": distraction_changed,
        },
        "explanation_summary": explanation_summary,
    }


