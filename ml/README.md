# ML module plan

This package is intentionally structural in the foundation task. It will contain data loading/generation, versioned feature engineering, three interpretable prediction tasks, SHAP explainability, bounded counterfactual analysis, and evaluation utilities.

Planned modules:

- `data/` data loading and explicitly documented development fixtures
- `features/` session-to-feature transformations
- `models/` focus, distraction, and performance model definitions
- `explainability/` SHAP adapters and explanation serialization
- `counterfactuals/` constrained what-if prediction analysis
- `evaluation/` offline metrics and intervention uplift summaries

No model is trained or fabricated by the foundation setup.