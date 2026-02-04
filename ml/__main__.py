"""CLI entry point for FLux ML pipeline.

Usage:
    python -m ml train --input data.json --output model_params.json
"""

import sys


def main():
    if len(sys.argv) < 2:
        print("FLux ML Pipeline")
        print()
        print("Usage:")
        print("  python -m ml train --input <file> --output <file>")
        print()
        print("Commands:")
        print("  train    Train the cycle prediction model")
        print()
        print("Examples:")
        print("  python -m ml train --input flo_export.json --output model_params.json")
        print("  python -m ml train -i exported_data.json -o model_params.json --model weighted_average")
        sys.exit(0)

    command = sys.argv[1]

    if command == "train":
        # Remove 'train' from argv and run training script
        sys.argv = [sys.argv[0]] + sys.argv[2:]
        from ml.training.train import main as train_main
        train_main()
    else:
        print(f"Unknown command: {command}")
        print("Available commands: train")
        sys.exit(1)


if __name__ == "__main__":
    main()
