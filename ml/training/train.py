"""Training script for cycle prediction model.

Usage:
    # Initial training from Flo export
    python -m ml.train --input flo_export.json --output model_params.json

    # Retraining from FLux app export
    python -m ml.train --input app_export.json --output model_params.json --format app

    # Use weighted average instead of Prophet
    python -m ml.train --input data.json --output model_params.json --model weighted_average
"""

import argparse
import json
import sys
from pathlib import Path

from ml.models.cycle_predictor import CyclePredictor
from ml.preprocessing.flo_parser import parse_flo_export, parse_app_export
from ml.preprocessing.feature_engineering import compute_cycle_features


def detect_format(file_path: Path) -> str:
    """Auto-detect whether input is Flo export or FLux app export."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # FLux app exports have "exported_at" field
    if "exported_at" in data or "exportedAt" in data:
        return "app"
    return "flo"


def train(
    input_path: str,
    output_path: str,
    input_format: str = "auto",
    model_type: str = "auto",
    verbose: bool = True,
) -> None:
    """Train cycle prediction model.

    Args:
        input_path: Path to input JSON file (Flo export or app export)
        output_path: Path to save model_params.json
        input_format: "flo", "app", or "auto" (detect automatically)
        model_type: "prophet", "weighted_average", or "auto"
        verbose: Print progress messages
    """
    input_file = Path(input_path)
    output_file = Path(output_path)

    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    # Detect format if auto
    if input_format == "auto":
        input_format = detect_format(input_file)
        if verbose:
            print(f"Detected input format: {input_format}")

    # Parse input data
    if verbose:
        print(f"Loading data from {input_file}")

    if input_format == "app":
        app_export = parse_app_export(input_file)
        cycles = app_export.cycles
        logs = app_export.logs
    else:
        cycles, logs = parse_flo_export(input_file)

    if verbose:
        print(f"Found {len(cycles)} cycles")
        if logs:
            print(f"Found {len(logs)} daily log entries")

    # Validate data
    if len(cycles) < 3:
        print("Error: Need at least 3 cycles for meaningful predictions")
        print("Please add more cycle data and try again.")
        sys.exit(1)

    # Compute features for display
    features = compute_cycle_features(cycles)
    if "error" in features:
        print(f"Error: {features['error']}")
        sys.exit(1)

    if verbose:
        print(f"\nCycle statistics:")
        print(f"  Valid cycles: {features['n_cycles']}")
        print(f"  Average length: {features['mean_length']:.1f} days")
        print(f"  Std deviation: {features['std_length']:.1f} days")
        print(f"  Range: {features['min_length']}-{features['max_length']} days")
        print(f"  Regularity score: {features['regularity_score']:.2f}")

    # Train model
    if verbose:
        print(f"\nTraining model (type: {model_type})...")

    predictor = CyclePredictor(model_type=model_type)
    predictor.fit(cycles)

    # Get prediction
    prediction = predictor.predict()
    if verbose:
        print(f"\nPrediction:")
        print(f"  Next period: {prediction.next_period_date}")
        print(f"  Expected cycle length: {prediction.expected_cycle_length} days")
        print(f"  Confidence: {prediction.confidence:.0%}")
        if prediction.fertile_window_start:
            print(f"  Fertile window: {prediction.fertile_window_start} to {prediction.fertile_window_end}")

    # Save model parameters
    if verbose:
        print(f"\nSaving model to {output_file}")

    predictor.save(output_file)

    if verbose:
        print("\nDone! Import model_params.json into the FLux app.")


def main():
    parser = argparse.ArgumentParser(
        description="Train FLux cycle prediction model",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Initial training from Flo export
  python -m ml.train --input ~/Downloads/flo_export.json --output model_params.json

  # Monthly retraining from app export
  python -m ml.train --input exported_data.json --output model_params.json

  # Force weighted average model (if Prophet not installed)
  python -m ml.train --input data.json --output model_params.json --model weighted_average
        """,
    )

    parser.add_argument(
        "--input", "-i",
        type=str,
        required=True,
        help="Path to input JSON file (Flo export or FLux app export)",
    )

    parser.add_argument(
        "--output", "-o",
        type=str,
        default="model_params.json",
        help="Path to save model parameters (default: model_params.json)",
    )

    parser.add_argument(
        "--format", "-f",
        type=str,
        choices=["flo", "app", "auto"],
        default="auto",
        help="Input format: 'flo' for Flo export, 'app' for FLux export, 'auto' to detect (default: auto)",
    )

    parser.add_argument(
        "--model", "-m",
        type=str,
        choices=["prophet", "weighted_average", "auto"],
        default="auto",
        help="Model type: 'prophet', 'weighted_average', or 'auto' (default: auto)",
    )

    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress progress messages",
    )

    args = parser.parse_args()

    train(
        input_path=args.input,
        output_path=args.output,
        input_format=args.format,
        model_type=args.model,
        verbose=not args.quiet,
    )


if __name__ == "__main__":
    main()
