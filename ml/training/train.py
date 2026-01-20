"""Training script for cycle prediction model."""

import argparse
from pathlib import Path

from ml.models.cycle_predictor import CyclePredictor
from ml.preprocessing.flo_parser import parse_flo_export


def train_from_flo_export(export_path: str, output_model_path: str):
    """Train model from Flo app export data.

    This runs entirely locally - no data leaves the device.
    """
    print(f"Loading data from {export_path}")
    cycles = parse_flo_export(export_path)
    print(f"Found {len(cycles)} cycles")

    if len(cycles) < 3:
        print("Warning: Need at least 3 cycles for meaningful predictions")

    print("Training model...")
    predictor = CyclePredictor()
    predictor.fit(cycles)

    print(f"Saving model to {output_model_path}")
    predictor.save(output_model_path)
    print("Done!")


def main():
    parser = argparse.ArgumentParser(description="Train cycle prediction model")
    parser.add_argument(
        "--input",
        type=str,
        required=True,
        help="Path to Flo export file",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models/cycle_predictor.pkl",
        help="Path to save trained model",
    )

    args = parser.parse_args()
    train_from_flo_export(args.input, args.output)


if __name__ == "__main__":
    main()
