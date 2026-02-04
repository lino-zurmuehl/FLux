/**
 * Visuelle Fortschrittsanzeige für den aktuellen Zyklus.
 */

interface Props {
  currentDay: number;
  cycleLength: number;
  periodLength: number;
}

export function CycleProgress({ currentDay, cycleLength, periodLength }: Props) {
  const progress = Math.min((currentDay / cycleLength) * 100, 100);
  const periodEndPercent = (periodLength / cycleLength) * 100;

  // Fruchtbares Fenster ist typischerweise Tag 10-16 bei einem 28-Tage-Zyklus
  // Proportional zur tatsächlichen Zykluslänge skalieren
  const fertileStartPercent = (10 / 28) * 100;
  const fertileEndPercent = (16 / 28) * 100;

  return (
    <div className="card mt-4">
      <h3 className="font-medium text-gray-700 mb-3">Zyklusfortschritt</h3>

      {/* Fortschrittsbalken */}
      <div className="relative h-4 bg-sky-100 rounded-full overflow-hidden">
        {/* Periodenphase */}
        <div
          className="absolute left-0 top-0 h-full bg-primary-200"
          style={{ width: `${periodEndPercent}%` }}
        />

        {/* Fruchtbares Fenster */}
        <div
          className="absolute top-0 h-full bg-sky-300"
          style={{
            left: `${fertileStartPercent}%`,
            width: `${fertileEndPercent - fertileStartPercent}%`,
          }}
        />

        {/* Aktuelle Position */}
        <div
          className="absolute top-0 h-full bg-primary-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />

        {/* Aktueller Tag Markierung */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary-700 rounded-full shadow transition-all duration-300"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Beschriftung */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Tag 1</span>
        <span>Tag {cycleLength}</span>
      </div>

      {/* Legende */}
      <div className="flex gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary-200 rounded" />
          <span className="text-gray-600">Periode</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-sky-300 rounded" />
          <span className="text-gray-600">Fruchtbar</span>
        </div>
      </div>
    </div>
  );
}
