"""Synthetic Dataset Generator for FocusSense AI (Task 11).

Generates a reproducible 10,000-session synthetic dataset with realistic
behavioural relationships and controlled noise for initial model development
and benchmarking.
"""

import os
from pathlib import Path
import numpy as np
import pandas as pd


def generate_synthetic_dataset(
    num_samples: int = 10000, random_seed: int = 42
) -> pd.DataFrame:
    """Generate relationship-aware synthetic study session data."""
    rng = np.random.default_rng(random_seed)

    # 1. Total Session Duration (seconds, 5 mins to 4 hours)
    total_session_duration = rng.uniform(300.0, 14400.0, size=num_samples)

    # 2. Productive Ratio & Durations
    # Beta distribution favoring realistic study sessions
    productive_ratio = rng.beta(a=3.5, b=1.5, size=num_samples)
    productive_duration = total_session_duration * productive_ratio

    # Remaining duration split between distraction and break
    remaining_duration = total_session_duration - productive_duration
    distraction_fraction = rng.beta(a=1.5, b=3.5, size=num_samples)
    distraction_duration = remaining_duration * distraction_fraction
    break_duration = remaining_duration - distraction_duration

    # Ratios
    productive_activity_ratio = np.clip(productive_duration / total_session_duration, 0.0, 1.0)
    distraction_activity_ratio = np.clip(distraction_duration / total_session_duration, 0.0, 1.0)

    # 3. Context Switches & Event Counts
    activity_switch_count = rng.poisson(lam=12.0 * (1.0 - productive_activity_ratio + 0.5 * distraction_activity_ratio), size=num_samples)
    activity_switch_count = np.clip(activity_switch_count, 0, 60)

    activity_count = activity_switch_count + rng.integers(1, 15, size=num_samples)
    unique_application_count = np.clip(rng.integers(1, 5, size=num_samples) + (activity_switch_count // 5), 1, 20)

    # 4. Academic Feature (Quiz Score 0-100)
    quiz_score = rng.normal(loc=72.0, scale=15.0, size=num_samples)
    quiz_score = np.clip(quiz_score, 0.0, 100.0)

    # ---------------------------------------------------------------------------
    # TARGET GENERATION (WITH CONTROLLED NOISE & REALISTIC CORRELATIONS)
    # ---------------------------------------------------------------------------
    # Target 1: Focus Score (Continuous 0.0 - 100.0)
    # Higher productive ratio -> higher focus
    # Higher distraction ratio & switch count -> lower focus
    raw_focus = (
        65.0 * productive_activity_ratio
        - 35.0 * distraction_activity_ratio
        - 0.5 * activity_switch_count
        + 30.0
        + rng.normal(0.0, 6.0, size=num_samples)
    )
    focus_score = np.clip(raw_focus, 0.0, 100.0)

    # Target 2: Distraction Level (Categorical: LOW, MEDIUM, HIGH)
    distraction_level = []
    for i in range(num_samples):
        d_ratio = distraction_activity_ratio[i]
        switches = activity_switch_count[i]

        # Primary rule-based score + noise
        score = d_ratio * 100.0 + switches * 1.5 + rng.normal(0.0, 5.0)

        if score < 25.0:
            distraction_level.append("LOW")
        elif score > 50.0:
            distraction_level.append("HIGH")
        else:
            distraction_level.append("MEDIUM")

    # Target 3: Performance Score (Continuous 0.0 - 100.0)
    # Dependent on focus score, quiz score, and productive ratio
    raw_performance = (
        0.45 * focus_score
        + 0.35 * quiz_score
        + 15.0 * productive_activity_ratio
        + rng.normal(0.0, 5.0, size=num_samples)
    )
    performance_score = np.clip(raw_performance, 0.0, 100.0)

    df = pd.DataFrame(
        {
            "total_session_duration": np.round(total_session_duration, 1),
            "productive_duration": np.round(productive_duration, 1),
            "distraction_duration": np.round(distraction_duration, 1),
            "break_duration": np.round(break_duration, 1),
            "productive_activity_ratio": np.round(productive_activity_ratio, 4),
            "distraction_activity_ratio": np.round(distraction_activity_ratio, 4),
            "activity_switch_count": activity_switch_count,
            "activity_count": activity_count,
            "unique_application_count": unique_application_count,
            "quiz_score": np.round(quiz_score, 1),
            "focus_score": np.round(focus_score, 1),
            "distraction_level": distraction_level,
            "performance_score": np.round(performance_score, 1),
        }
    )

    return df


if __name__ == "__main__":
    output_dir = Path(__file__).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "dataset.csv"

    print("Generating 10,000 synthetic study sessions...")
    dataset = generate_synthetic_dataset(num_samples=10000, random_seed=42)
    dataset.to_csv(csv_path, index=False)
    print(f"Dataset successfully saved to: {csv_path.resolve()}")
    print("\nDataset Summary:")
    print(dataset.describe())
    print("\nDistraction Level Distribution:")
    print(dataset["distraction_level"].value_counts(normalize=True))

