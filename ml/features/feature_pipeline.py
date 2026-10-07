"""Feature Pipeline for FocusSense AI (Task 11).

Defines input features, targets, preprocessor pipeline, target leakage checks,
and feature DataFrame preparation.
"""

from typing import Any
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

# 10 Input Features
FEATURE_NAMES: list[str] = [
    "total_session_duration",
    "productive_duration",
    "distraction_duration",
    "break_duration",
    "productive_activity_ratio",
    "distraction_activity_ratio",
    "activity_switch_count",
    "activity_count",
    "unique_application_count",
    "quiz_score",
]

# 3 Prediction Targets
TARGET_NAMES: list[str] = [
    "focus_score",
    "distraction_level",
    "performance_score",
]


def verify_no_target_leakage() -> bool:
    """Ensure no target variables are present in the feature set."""
    intersection = set(FEATURE_NAMES).intersection(set(TARGET_NAMES))
    if intersection:
        raise ValueError(f"TARGET LEAKAGE DETECTED! Features contain target variables: {intersection}")
    return True


def build_feature_preprocessor() -> ColumnTransformer:
    """Build a ColumnTransformer for feature scaling and missing value imputation."""
    verify_no_target_leakage()

    # Median imputer for nullable quiz_score + StandardScaler for feature normalization
    pipeline = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), FEATURE_NAMES),
        ],
        remainder="drop",
    )
    return pipeline


def prepare_feature_dataframe(raw_features: dict[str, Any] | pd.DataFrame) -> pd.DataFrame:
    """Format raw feature dictionary or DataFrame to match exact FEATURE_NAMES order."""
    if isinstance(raw_features, dict):
        df = pd.DataFrame([raw_features])
    else:
        df = raw_features.copy()

    # Ensure all required features exist, filling missing keys with None for imputation
    for col in FEATURE_NAMES:
        if col not in df.columns:
            df[col] = None

    return df[FEATURE_NAMES]
