/**
 * Kreisförmige Fortschrittsanzeige für den aktuellen Zyklus.
 */

interface Props {
  currentDay: number;
  cycleLength: number;
  periodLength: number;
  fertileStart?: number; // Day of cycle
  fertileEnd?: number; // Day of cycle
}

export function CycleProgress({
  currentDay,
  cycleLength,
  periodLength,
  fertileStart,
  fertileEnd,
}: Props) {
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate day ranges
  // Fertile window: typically around ovulation (day 14 in a 28-day cycle)
  // Default: 5 days before ovulation to 1 day after
  const ovulationDay = Math.round(cycleLength - 14); // ~14 days before next period
  const fertileStartDay = fertileStart ?? Math.max(periodLength + 1, ovulationDay - 5);
  const fertileEndDay = fertileEnd ?? ovulationDay + 1;

  // Convert days to percentages (0-1)
  const periodEndPercent = periodLength / cycleLength;
  const fertileStartPercent = (fertileStartDay - 1) / cycleLength;
  const fertileEndPercent = fertileEndDay / cycleLength;
  const currentPercent = Math.min(currentDay / cycleLength, 1);

  // SVG dash calculations
  // Period: starts at 0 (top of circle after rotation)
  const periodDash = circumference * periodEndPercent;

  // Fertile window: starts at fertileStartPercent
  const fertileDash = circumference * (fertileEndPercent - fertileStartPercent);
  // Negative offset moves dash forward (clockwise after rotation)
  const fertileOffset = -circumference * fertileStartPercent;

  // Progress arc
  const progressDash = circumference * currentPercent;

  // Calculate marker position (angle from top, clockwise)
  const angle = (currentPercent * 360 - 90) * (Math.PI / 180);
  const markerX = center + radius * Math.cos(angle);
  const markerY = center + radius * Math.sin(angle);

  // Determine current phase
  let phase = 'Follikelphase';
  let phaseColor = 'text-gray-600';
  if (currentDay <= periodLength) {
    phase = 'Periode';
    phaseColor = 'text-primary-600';
  } else if (currentDay >= fertileStartDay && currentDay <= fertileEndDay) {
    phase = 'Fruchtbar';
    phaseColor = 'text-sky-600';
  } else if (currentDay > fertileEndDay) {
    phase = 'Lutealphase';
    phaseColor = 'text-gray-600';
  }

  return (
    <div className="card mt-4">
      <h3 className="font-medium text-gray-700 mb-4 text-center">Zyklusfortschritt</h3>

      <div className="flex justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#e0f2fe"
              strokeWidth={strokeWidth}
            />

            {/* Period phase (starts at top) */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#fecdd3"
              strokeWidth={strokeWidth}
              strokeDasharray={`${periodDash} ${circumference - periodDash}`}
              strokeLinecap="round"
            />

            {/* Fertile window (offset to correct position) */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth={strokeWidth}
              strokeDasharray={`${fertileDash} ${circumference - fertileDash}`}
              strokeDashoffset={fertileOffset}
              strokeLinecap="round"
            />

            {/* Progress arc (inner, shows current position) */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#be123c"
              strokeWidth={strokeWidth - 10}
              strokeDasharray={`${progressDash} ${circumference - progressDash}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>

          {/* Current day marker */}
          <div
            className="absolute w-5 h-5 bg-white border-3 border-primary-700 rounded-full shadow-lg transition-all duration-500"
            style={{
              left: markerX - 10,
              top: markerY - 10,
              borderWidth: '3px',
            }}
          />

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-primary-700">{currentDay}</span>
            <span className="text-sm text-gray-500">von {cycleLength}</span>
            <span className={`text-xs font-medium mt-1 ${phaseColor}`}>{phase}</span>
          </div>
        </div>
      </div>

      {/* Legende */}
      <div className="flex justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary-200 rounded-full" />
          <span className="text-gray-600">Periode ({periodLength}T)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-sky-300 rounded-full" />
          <span className="text-gray-600">Fruchtbar (T{fertileStartDay}-{fertileEndDay})</span>
        </div>
      </div>
    </div>
  );
}
