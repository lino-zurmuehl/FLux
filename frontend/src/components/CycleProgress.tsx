/**
 * Zyklusring: zeigt Periode und das Zeitfenster rund um den Eisprung als
 * Segmente, der heutige Tag ist ein Marker auf dem Ring.
 * Wird im Dashboard in die Vorhersage-Karte eingebettet.
 */

interface PhaseInput {
  currentDay: number;
  cycleLength: number;
  periodLength: number;
  fertileStart?: number; // Day of cycle
  fertileEnd?: number; // Day of cycle
}

interface Props extends PhaseInput {
  /** Ring-Durchmesser in px. */
  size?: number;
  /** Legende unter dem Ring ausblenden. */
  hideLegend?: boolean;
}

export type CyclePhaseKey = 'period' | 'follicular' | 'fertile' | 'luteal' | 'overdue';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const PHASE_LABELS: Record<CyclePhaseKey, string> = {
  period: 'Periode',
  follicular: 'Follikelphase',
  fertile: 'Rund um den Eisprung',
  luteal: 'Lutealphase',
  overdue: 'Überfällig',
};

/** Leitet Phase und Segmentgrenzen aus Zyklustag und Zykluslänge ab. */
export function getCyclePhase({ currentDay, cycleLength, periodLength, fertileStart, fertileEnd }: PhaseInput) {
  const safeCycleLength = Math.max(1, Math.round(cycleLength));
  const safePeriodLength = clamp(Math.round(periodLength), 1, safeCycleLength);
  const safeCurrentDay = Math.max(1, Math.round(currentDay));
  const isOverdue = safeCurrentDay > safeCycleLength;

  // Same six-day estimate as the model: five days before its estimated end.
  // Cycle days count from 1; the next start is cycleLength days after this start.
  const ovulationDay = clamp(Math.round(safeCycleLength - 14 + 1), 1, safeCycleLength);
  const defaultFertileStart = clamp(Math.max(safePeriodLength + 1, ovulationDay - 5), 1, safeCycleLength);
  const defaultFertileEnd = clamp(Math.max(defaultFertileStart, ovulationDay), defaultFertileStart, safeCycleLength);

  const fertileStartDay = fertileStart
    ? clamp(Math.round(fertileStart), 1, safeCycleLength)
    : defaultFertileStart;
  const fertileEndDay = fertileEnd
    ? clamp(Math.round(fertileEnd), fertileStartDay, safeCycleLength)
    : defaultFertileEnd;

  let key: CyclePhaseKey = 'follicular';
  if (isOverdue) key = 'overdue';
  else if (safeCurrentDay <= safePeriodLength) key = 'period';
  else if (safeCurrentDay >= fertileStartDay && safeCurrentDay <= fertileEndDay) key = 'fertile';
  else if (safeCurrentDay > fertileEndDay) key = 'luteal';

  return {
    key,
    label: PHASE_LABELS[key],
    isOverdue,
    safeCycleLength,
    safePeriodLength,
    safeCurrentDay,
    fertileStartDay,
    fertileEndDay,
  };
}

const PHASE_TEXT: Record<CyclePhaseKey, string> = {
  period: 'text-primary-700',
  follicular: 'text-gray-600',
  fertile: 'text-sky-700',
  luteal: 'text-gray-600',
  overdue: 'text-red-600',
};

export function CycleProgress({ size = 200, hideLegend = false, ...input }: Props) {
  const {
    key,
    label,
    isOverdue,
    safeCycleLength,
    safePeriodLength,
    safeCurrentDay,
    fertileStartDay,
    fertileEndDay,
  } = getCyclePhase(input);

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Segment from the start of `fromDay` to the end of `toDay`. Round caps add
  // half a stroke on each side, so the dash is shortened to stay inside its days.
  const segment = (fromDay: number, toDay: number) => {
    const start = ((fromDay - 1) / safeCycleLength) * circumference;
    const length = ((toDay - fromDay + 1) / safeCycleLength) * circumference;
    const dash = Math.max(0.1, length - strokeWidth);
    return {
      strokeDasharray: `${dash} ${circumference - dash}`,
      strokeDashoffset: -(start + strokeWidth / 2),
    };
  };

  // Marker sits in the middle of the current day.
  const currentPercent = isOverdue ? 1 : (safeCurrentDay - 0.5) / safeCycleLength;
  const angle = (currentPercent * 360 - 90) * (Math.PI / 180);
  const markerX = center + radius * Math.cos(angle);
  const markerY = center + radius * Math.sin(angle);

  return (
    <div>
      <div className="flex justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
            <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={strokeWidth} />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#be123c"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              {...segment(1, safePeriodLength)}
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              {...segment(fertileStartDay, fertileEndDay)}
            />
          </svg>

          {/* Heute-Marker */}
          <div
            className="absolute w-6 h-6 rounded-full bg-white shadow-md transition-all duration-500"
            style={{ left: markerX - 12, top: markerY - 12, border: '4px solid #4c0d1c' }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Zyklustag</span>
            <span className="text-5xl font-bold text-primary-800 leading-none mt-1 tabular-nums">
              {isOverdue ? safeCycleLength : safeCurrentDay}
            </span>
            <span className="text-sm text-gray-500 mt-1">von {safeCycleLength}</span>
            {isOverdue && (
              <span className="text-xs font-semibold text-red-600">
                +{safeCurrentDay - safeCycleLength} Tage
              </span>
            )}
            <span className={`text-xs font-semibold mt-1 ${PHASE_TEXT[key]}`}>{label}</span>
          </div>
        </div>
      </div>

      {!hideLegend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-primary-500 rounded-full" />
            Periode ({safePeriodLength}T)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-300 rounded-full" />
            Rund um den Eisprung (T{fertileStartDay}–{fertileEndDay})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white" style={{ border: '2px solid #4c0d1c' }} />
            Heute
          </span>
        </div>
      )}
    </div>
  );
}
