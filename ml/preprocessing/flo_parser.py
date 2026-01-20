"""Parser for Flo app data exports."""

import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from backend.models.schemas import CycleData


class FloParser:
    """Parse Flo app export data into cycle records."""

    def __init__(self, file_path: str | Path):
        self.file_path = Path(file_path)
        self.raw_data = None

    def load(self) -> dict:
        """Load the Flo export file."""
        # Flo exports can be JSON or CSV depending on version
        if self.file_path.suffix == ".json":
            with open(self.file_path, "r", encoding="utf-8") as f:
                self.raw_data = json.load(f)
        else:
            raise ValueError(f"Unsupported file format: {self.file_path.suffix}")
        return self.raw_data

    def parse_cycles(self) -> list[CycleData]:
        """Extract cycle data from Flo export.

        Note: The exact structure depends on Flo's export format.
        This should be adapted based on actual export files.
        """
        if self.raw_data is None:
            self.load()

        cycles = []

        # TODO: Adapt based on actual Flo export structure
        # Common fields to look for:
        # - period_start_dates
        # - cycle_length
        # - flow_intensity
        # - symptoms

        # Placeholder structure - update when we see actual export format
        if "periods" in self.raw_data:
            for period in self.raw_data["periods"]:
                cycle = CycleData(
                    start_date=self._parse_date(period.get("start_date")),
                    end_date=self._parse_date(period.get("end_date")),
                    flow_intensity=period.get("flow_intensity"),
                    symptoms=period.get("symptoms", []),
                )
                cycles.append(cycle)

        return cycles

    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        """Parse date string to date object."""
        if not date_str:
            return None

        # Try common date formats
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        return None


def parse_flo_export(file_path: str | Path) -> list[CycleData]:
    """Convenience function to parse Flo export file."""
    parser = FloParser(file_path)
    return parser.parse_cycles()
