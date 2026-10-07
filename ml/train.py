"""ML Model Training Script for FocusSense AI (Task 11).

Trains Focus Score Regressor, Distraction Classifier, and Performance Regressor
on the synthetic dataset, evaluates performance on unseen test split, and persists
joblib artifacts into ml/models/artifacts/.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from ml.data.generate_dataset import generate_synthetic_dataset
from ml.features.feature_pipeline import (
    FEATURE_NAMES,
    TARGET_NAMES,
    build_feature_preprocessor,
    verify_no_target_leakage,
)


def train_and_persist_models():
    verify_no_target_leakage()
    print("Target leakage check passed cleanly.")

    # 1. Load or Generate Synthetic Dataset
    data_path = PROJECT_ROOT / "ml" / "data" / "dataset.csv"
    if data_path.exists():
        print(f"Loading existing dataset from {data_path}...")
        df = pd.read_csv(data_path)
    else:
        print("Generating synthetic dataset (10,000 samples, random_state=42)...")
        df = generate_synthetic_dataset(num_samples=10000, random_seed=42)
        os.makedirs(data_path.parent, exist_ok=True)
        df.to_csv(data_path, index=False)
        print(f"Dataset saved to {data_path}")

    X = df[FEATURE_NAMES]
    y_focus = df["focus_score"]
    y_distraction = df["distraction_level"]
    y_performance = df["performance_score"]

    # 2. Train/Validation/Test Split (70 / 15 / 15)
    X_train, X_temp, y_f_train, y_f_temp, y_d_train, y_d_temp, y_p_train, y_p_temp = train_test_split(
        X, y_focus, y_distraction, y_performance, test_size=0.30, random_state=42
    )

    X_val, X_test, y_f_val, y_f_test, y_d_val, y_d_test, y_p_val, y_p_test = train_test_split(
        X_temp, y_f_temp, y_d_temp, y_p_temp, test_size=0.50, random_state=42
    )

    # 3. Fit Preprocessor
    preprocessor = build_feature_preprocessor()
    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)

    # 4. Train Model 1: Focus Score Regressor
    print("Training Focus Score Regressor...")
    focus_regressor = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    focus_regressor.fit(X_train_proc, y_f_train)
    y_f_pred = focus_regressor.predict(X_test_proc)
    f_mae = float(mean_absolute_error(y_f_test, y_f_pred))
    f_rmse = float(np.sqrt(mean_squared_error(y_f_test, y_f_pred)))
    f_r2 = float(r2_score(y_f_test, y_f_pred))
    print(f"Focus Regressor -> MAE: {f_mae:.4f}, RMSE: {f_rmse:.4f}, R2: {f_r2:.4f}")

    # 5. Train Model 2: Distraction Level Classifier
    print("Training Distraction Level Classifier...")
    distraction_classifier = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    distraction_classifier.fit(X_train_proc, y_d_train)
    y_d_pred = distraction_classifier.predict(X_test_proc)
    d_acc = float(accuracy_score(y_d_test, y_d_pred))
    d_f1 = float(f1_score(y_d_test, y_d_pred, average="macro"))
    print(f"Distraction Classifier -> Accuracy: {d_acc:.4f}, Macro F1: {d_f1:.4f}")

    # 6. Train Model 3: Performance Score Regressor
    print("Training Performance Score Regressor...")
    performance_regressor = GradientBoostingRegressor(n_estimators=100, learning_rate=0.08, max_depth=5, random_state=42)
    performance_regressor.fit(X_train_proc, y_p_train)
    y_p_pred = performance_regressor.predict(X_test_proc)
    p_mae = float(mean_absolute_error(y_p_test, y_p_pred))
    p_rmse = float(np.sqrt(mean_squared_error(y_p_test, y_p_pred)))
    p_r2 = float(r2_score(y_p_test, y_p_pred))
    print(f"Performance Regressor -> MAE: {p_mae:.4f}, RMSE: {p_rmse:.4f}, R2: {p_r2:.4f}")

    # 7. Persist Artifacts
    artifacts_dir = PROJECT_ROOT / "ml" / "models" / "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)

    joblib.dump(preprocessor, artifacts_dir / "preprocessor.joblib")
    joblib.dump(focus_regressor, artifacts_dir / "focus_regressor.joblib")
    joblib.dump(distraction_classifier, artifacts_dir / "distraction_classifier.joblib")
    joblib.dump(performance_regressor, artifacts_dir / "performance_regressor.joblib")

    metadata = {
        "model_version": "v1.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "feature_names": FEATURE_NAMES,
        "target_names": TARGET_NAMES,
        "disclaimer": "Development initial model trained on synthetic dataset for offline benchmarking.",
        "metrics": {
            "focus_regressor": {"mae": f_mae, "rmse": f_rmse, "r2": f_r2},
            "distraction_classifier": {"accuracy": d_acc, "macro_f1": d_f1},
            "performance_regressor": {"mae": p_mae, "rmse": p_rmse, "r2": p_r2},
        },
    }

    with open(artifacts_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Artifacts successfully saved to {artifacts_dir}")


if __name__ == "__main__":
    train_and_persist_models()
