"""Parser for Flo app data exports and FLux app exports.

Handles Flo GDPR export format and converts categories to FLux internal format.
"""

import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from ml.models.schemas import Cycle, DailyLog, AppExport

# Mapping from Flo subcategories to our internal values
FLO_SYMPTOM_MAP = {
    "Acne": "acne",
    "Backache": "backache",
    "Bloating": "bloating",
    "Cravings": "cravings",
    "DrawingPain": "cramps",  # Flo calls cramps "DrawingPain"
    "Diarrhea": "diarrhea",
    "Fatigue": "fatigue",
    "FeelGood": "feel_good",
    "Headache": "headache",
    "Insomnia": "insomnia",
    "TenderBreasts": "tender_breasts",
}

FLO_MOOD_MAP = {
    "Happy": "happy",
    "Energetic": "energetic",
    "Neutral": "neutral",
    "Sad": "sad",
    "Angry": "angry",
    "Panic": "anxious",  # Flo uses "Panic" for anxiety
    "Depressed": "depressed",
    "Apathetic": "apathetic",
    "Confused": "confused",
    "Swings": "mood_swings",
    "VerySelfCritical": "self_critical",
    "FeelingGuilty": "feeling_guilty",
}

FLO_FLUID_MAP = {
    "Dry": "dry",
    "Sticky": "sticky",
    "Creamy": "creamy",
    "Eggwhite": "eggwhite",
    "ClumpyWhite": "clumpy_white",
    "Bloody": "bloody",
}

FLO_DISTURBER_MAP = {
    "Stress": "stress",
    "Alcohol": "alcohol",
}

FLO_SEX_DRIVE_MAP = {
    "High Sex Drive": "high",
    "None": "none",
}

# Flo period intensity (0-3) to our flow values
FLO_FLOW_MAP = {
    0: "spotting",
    1: "light",
    2: "medium",
    3: "heavy",
}


class FloParser:
    """Parse Flo app export data into cycle records.

    Flo export format varies by version. This parser attempts to handle
    common structures. You may need to adapt based on your actual export.
    """

    def __init__(self, file_path: str | Path):
        self.file_path = Path(file_path)
        self.raw_data: Optional[dict] = None

    def load(self) -> dict:
        """Load the Flo export file."""
        if self.file_path.suffix == ".json":
            with open(self.file_path, "r", encoding="utf-8") as f:
                self.raw_data = json.load(f)
        else:
            raise ValueError(f"Unsupported file format: {self.file_path.suffix}")
        return self.raw_data

    def parse(self) -> tuple[list[Cycle], list[DailyLog]]:
        """Extract cycles and daily logs from Flo export.

        Returns:
            Tuple of (cycles, daily_logs)
        """
        if self.raw_data is None:
            self.load()

        assert self.raw_data is not None

        cycles = self._parse_cycles()
        logs = self._parse_logs()

        return cycles, logs

    def _parse_cycles(self) -> list[Cycle]:
        """Extract cycle data from Flo export."""
        assert self.raw_data is not None
        cycles: list[Cycle] = []

        # Try different possible Flo export structures
        period_data = None

        # Structure 1: Flo GDPR export format - operationalData.cycles
        if "operationalData" in self.raw_data:
            op_data = self.raw_data["operationalData"]
            if isinstance(op_data, dict) and "cycles" in op_data:
                period_data = op_data["cycles"]

        # Structure 2: "periods" array
        if period_data is None and "periods" in self.raw_data:
            period_data = self.raw_data["periods"]

        # Structure 3: "menstrual_cycles" array
        if period_data is None and "menstrual_cycles" in self.raw_data:
            period_data = self.raw_data["menstrual_cycles"]

        # Structure 4: "cycle_data" or "cycles" at top level
        if period_data is None and "cycle_data" in self.raw_data:
            period_data = self.raw_data["cycle_data"]
        if period_data is None and "cycles" in self.raw_data:
            period_data = self.raw_data["cycles"]

        # Structure 5: Nested under "data"
        if period_data is None and "data" in self.raw_data:
            data = self.raw_data["data"]
            if isinstance(data, dict):
                period_data = data.get("periods") or data.get("cycles")

        if period_data is None:
            print("Warning: Could not find period data in export.")
            print(f"Available keys: {list(self.raw_data.keys())}")
            return cycles

        for period in period_data:
            # Try various field names for start date
            start = self._parse_date(
                period.get("period_start_date")  # Flo GDPR format
                or period.get("start_date")
                or period.get("startDate")
                or period.get("start")
                or period.get("date")
            )
            if start is None:
                continue

            # Try various field names for end date
            end = self._parse_date(
                period.get("period_end_date")  # Flo GDPR format
                or period.get("end_date")
                or period.get("endDate")
                or period.get("end")
            )

            # Get cycle/period lengths if available
            length = period.get("cycle_length") or period.get("cycleLength")

            # Calculate period length from dates if not provided
            period_length = period.get("period_length") or period.get("periodLength")
            if period_length is None and end is not None:
                period_length = (end - start).days + 1

            cycle = Cycle(
                start_date=start,
                end_date=end,
                length=length,
                period_length=period_length,
            )
            cycles.append(cycle)

        # Sort by start date
        cycles.sort(key=lambda c: c.start_date)

        # Compute cycle lengths if not provided
        for i in range(len(cycles) - 1):
            if cycles[i].length is None:
                cycles[i].length = (cycles[i + 1].start_date - cycles[i].start_date).days

        # Compute period lengths from end dates if available
        for cycle in cycles:
            if cycle.period_length is None and cycle.end_date is not None:
                cycle.period_length = (cycle.end_date - cycle.start_date).days + 1

        return cycles

    def _parse_logs(self) -> list[DailyLog]:
        """Extract daily logs from Flo export."""
        assert self.raw_data is not None
        logs: list[DailyLog] = []

        # Try to find daily log data
        log_data = None

        # Check operationalData for point_events (Flo stores daily logs there)
        if "operationalData" in self.raw_data:
            op_data = self.raw_data["operationalData"]
            if isinstance(op_data, dict):
                # point_events_manual_v2 contains daily tracking data
                if "point_events_manual_v2" in op_data:
                    log_data = self._convert_point_events_to_logs(op_data["point_events_manual_v2"])

        if log_data is None and "daily_logs" in self.raw_data:
            log_data = self.raw_data["daily_logs"]
        if log_data is None and "logs" in self.raw_data:
            log_data = self.raw_data["logs"]
        if log_data is None and "symptoms" in self.raw_data:
            log_data = self._convert_symptoms_to_logs(self.raw_data["symptoms"])
        if log_data is None and "data" in self.raw_data:
            data = self.raw_data["data"]
            if isinstance(data, dict):
                log_data = data.get("daily_logs") or data.get("logs")

        if log_data is None:
            return logs

        for entry in log_data:
            log_date = self._parse_date(
                entry.get("date") or entry.get("log_date")
            )
            if log_date is None:
                continue

            log = DailyLog(
                date=log_date,
                flow=entry.get("flow") or entry.get("flow_intensity"),
                symptoms=entry.get("symptoms", []),
                mood=entry.get("mood"),
                fluid=entry.get("fluid"),
                sex_drive=entry.get("sex_drive"),
                disturbers=entry.get("disturbers", []),
                temperature=entry.get("temperature") or entry.get("bbt"),
                notes=entry.get("notes"),
            )
            logs.append(log)

        logs.sort(key=lambda l: l.date)
        return logs

    def _convert_point_events_to_logs(self, events: list) -> list[dict]:
        """Convert Flo point_events_manual_v2 to daily log format.

        Flo stores events with 'category' and 'subcategory' fields.
        We map these to our internal schema.
        """
        logs_by_date: dict[str, dict] = {}

        for event in events:
            date_str = event.get("date")
            if not date_str:
                continue

            # Parse the date to get just the date part
            parsed_date = self._parse_date(date_str)
            if parsed_date is None:
                continue

            date_key = parsed_date.isoformat()

            if date_key not in logs_by_date:
                logs_by_date[date_key] = {
                    "date": date_key,
                    "symptoms": [],
                    "disturbers": [],
                }

            category = event.get("category", "")
            subcategory = event.get("subcategory", "")

            # Map Flo categories to our schema
            if category == "Symptom" and subcategory in FLO_SYMPTOM_MAP:
                symptom = FLO_SYMPTOM_MAP[subcategory]
                if symptom not in logs_by_date[date_key]["symptoms"]:
                    logs_by_date[date_key]["symptoms"].append(symptom)

            elif category == "Mood" and subcategory in FLO_MOOD_MAP:
                logs_by_date[date_key]["mood"] = FLO_MOOD_MAP[subcategory]

            elif category == "Fluid" and subcategory in FLO_FLUID_MAP:
                logs_by_date[date_key]["fluid"] = FLO_FLUID_MAP[subcategory]

            elif category == "Disturber" and subcategory in FLO_DISTURBER_MAP:
                disturber = FLO_DISTURBER_MAP[subcategory]
                if disturber not in logs_by_date[date_key]["disturbers"]:
                    logs_by_date[date_key]["disturbers"].append(disturber)

            elif category == "Sex" and subcategory in FLO_SEX_DRIVE_MAP:
                logs_by_date[date_key]["sex_drive"] = FLO_SEX_DRIVE_MAP[subcategory]

        return list(logs_by_date.values())

    def _convert_symptoms_to_logs(self, symptoms_data: list) -> list[dict]:
        """Convert symptom entries to daily log format."""
        logs_by_date: dict[str, dict] = {}

        for symptom in symptoms_data:
            date_str = symptom.get("date")
            if not date_str:
                continue

            if date_str not in logs_by_date:
                logs_by_date[date_str] = {"date": date_str, "symptoms": []}

            symptom_name = symptom.get("symptom") or symptom.get("name")
            if symptom_name:
                logs_by_date[date_str]["symptoms"].append(symptom_name)

        return list(logs_by_date.values())

    def _parse_date(self, date_val: Optional[str | int]) -> Optional[date]:
        """Parse date string or timestamp to date object."""
        if date_val is None:
            return None

        # Handle Unix timestamp (milliseconds)
        if isinstance(date_val, int):
            if date_val > 1e12:  # Milliseconds
                return datetime.fromtimestamp(date_val / 1000).date()
            else:  # Seconds
                return datetime.fromtimestamp(date_val).date()

        # Handle string formats
        date_str = str(date_val)

        formats = [
            "%Y-%m-%d %H:%M:%S.%f",  # Flo GDPR format: "2018-10-22 00:00:00.0"
            "%Y-%m-%d %H:%M:%S",     # Without microseconds
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d.%m.%Y",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        return None


def parse_flo_export(file_path: str | Path) -> tuple[list[Cycle], list[DailyLog]]:
    """Convenience function to parse Flo export file."""
    parser = FloParser(file_path)
    return parser.parse()


def parse_app_export(file_path: str | Path) -> AppExport:
    """Parse FLux app export for retraining."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return AppExport(
        exported_at=datetime.fromisoformat(data["exported_at"].replace("Z", "+00:00")),
        cycles=[Cycle(**c) for c in data.get("cycles", [])],
        logs=[DailyLog(**l) for l in data.get("logs", [])],
    )
