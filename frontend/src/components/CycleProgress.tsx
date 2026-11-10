/**
 * Zyklusring: zeigt Periode und fruchtbare Phase (5 Tage vor bis 1 Tag nach
 * dem geschätzten Eisprung) als Segmente; Eisprung und heutiger Tag sind Marker.
 * Wird im Dashboard in die Vorhersage-Karte eingebettet.
 */

import {
  DAYS_FROM_OVULATION_TO_PERIOD,
  FERTILE_DAYS_AFTER_OVULATION,
  FERTILE_DAYS_BEFORE_OVULATION,
} from '../lib/ovulation';

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
  fertile: 'Fruchtbare Phase',
  luteal: 'Lutealphase',
  overdue: 'Überfällig',
};

/** Leitet Phase und Segmentgrenzen aus Zyklustag und Zykluslänge ab. */
export function getCyclePhase({ currentDay, cycleLength, periodLength, fertileStart, fertileEnd }: PhaseInput) {
  const safeCycleLength = Math.max(1, Math.round(cycleLength));
  const safePeriodLength = clamp(Math.round(periodLength), 1, safeCycleLength);
  const safeCurrentDay = Math.max(1, Math.round(currentDay));
  const isOverdue = safeCurrentDay > safeCycleLength;

  // Same estimate as lib/ovulation.ts: ovulation 14 days before the next start,
  // fertile phase from 5 days before to 1 day after it.
  // Cycle days count from 1; the next start is cycleLength days after this start.
  const defaultOvulationDay = clamp(
    Math.round(safeCycleLength - DAYS_FROM_OVULATION_TO_PERIOD + 1),
    1,
    safeCycleLength
  );
  const defaultFertileStart = clamp(
    Math.max(safePeriodLength + 1, defaultOvulationDay - FERTILE_DAYS_BEFORE_OVULATION),
    1,
    safeCycleLength
  );
  const defaultFertileEnd = clamp(
    Math.max(defaultFertileStart, defaultOvulationDay + FERTILE_DAYS_AFTER_OVULATION),
    defaultFertileStart,
    safeCycleLength
  );

  const fertileStartDay = fertileStart
    ? clamp(Math.round(fertileStart), 1, safeCycleLength)
    : defaultFertileStart;
  const fertileEndDay = fertileEnd
    ? clamp(Math.round(fertileEnd), fertileStartDay, safeCycleLength)
    : defaultFertileEnd;
  const ovulationDay = clamp(fertileEndDay - FERTILE_DAYS_AFTER_OVULATION, fertileStartDay, fertileEndDay);

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
    ovulationDay,
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
    ovulationDay,
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

  // Markers sit in the middle of their day.
  const pointAt = (percent: number) => {
    const angle = (percent * 360 - 90) * (Math.PI / 180);
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };
  const marker = pointAt(isOverdue ? 1 : (safeCurrentDay - 0.5) / safeCycleLength);
  const ovulation = pointAt((ovulationDay - 0.5) / safeCycleLength);

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

          {/* Geschätzter Eisprung */}
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-sky-700"
            style={{ left: ovulation.x - 5, top: ovulation.y - 5 }}
          />

          {/* Heute-Marker */}
          <div
            className="absolute w-6 h-6 rounded-full bg-white shadow-md transition-all duration-500"
            style={{ left: marker.x - 12, top: marker.y - 12, border: '4px solid #4c0d1c' }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Zyklustag</span>
            <span className="text-5xl font-bold text-primary-800 leading-none mt-1 tabular-nums">
              {isOverdue ? safeCycleLength : safeCurrentDay}
            </span>
            <span className="text-sm text-gray-500 mt-1 leading-tight">
              von {safeCycleLength}
              {isOverdue && (
                <span className="font-semibold text-red-600"> · +{safeCurrentDay - safeCycleLength}</span>
              )}
            </span>
            <span className={`text-xs font-semibold mt-1 leading-tight whitespace-nowrap ${PHASE_TEXT[key]}`}>{label}</span>
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
            Fruchtbare Phase (T{fertileStartDay}–{fertileEndDay})
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
