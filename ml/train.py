"""Compatibility module to support `python -m ml.train`."""

from ml.training.train import main


if __name__ == "__main__":
    main()

