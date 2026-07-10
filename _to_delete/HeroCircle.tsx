/**
 * Großer Tages-Kreis im Flo-Stil: zeigt die aktuelle Phase,
 * den wichtigsten Status und die primäre Aktion.
 */

export type HeroVariant = 'period' | 'fertile' | 'overdue' | 'default';

interface Props {
  variant: HeroVariant;
  topLabel: string;
  mainText: string;
  subText?: string;
  ctaLabel?: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
}

const VARIANT_STYLES: Record<
  HeroVariant,
  { halo: string; circle: string; top: string; sub: string; cta: string }
> = {
  period: {
    halo: 'bg-primary-200/50',
    circle: 'bg-gradient-to-b from-primary-400 via-primary-500 to-primary-700',
    top: 'text-primary-100',
    sub: 'text-primary-50/90',
    cta: 'bg-white text-primary-700 hover:bg-primary-50',
  },
  fertile: {
    halo: 'bg-sky-200/60',
    circle: 'bg-gradient-to-b from-sky-300 via-sky-400 to-sky-600',
    top: 'text-sky-50',
    sub: 'text-sky-50/90',
    cta: 'bg-white text-sky-700 hover:bg-sky-50',
  },
  overdue: {
    halo: 'bg-primary-300/50',
    circle: 'bg-gradient-to-b from-primary-600 via-primary-700 to-primary-900',
    top: 'text-primary-200',
    sub: 'text-primary-100/90',
    cta: 'bg-white text-primary-800 hover:bg-primary-50',
  },
  default: {
    halo: 'bg-primary-100/60',
    circle: 'bg-gradient-to-b from-primary-300 via-primary-400 to-primary-600',
    top: 'text-primary-100',
    sub: 'text-primary-50/90',
    cta: 'bg-white text-primary-700 hover:bg-primary-50',
  },
};

export function HeroCircle({
  variant,
  topLabel,
  mainText,
  subText,
  ctaLabel,
  onCta,
  ctaDisabled = false,
}: Props) {
  const s = VARIANT_STYLES[variant];

  return (
    <div className="flex justify-center my-2">
      {/* Weicher Außenring (Halo) */}
      <div className={`rounded-full p-3 ${s.halo}`}>
        <div
          className={`w-64 h-64 rounded-full ${s.circle} shadow-xl flex flex-col items-center justify-center text-center px-6`}
        >
          <span className={`text-xs font-semibold uppercase tracking-widest ${s.top}`}>
            {topLabel}
          </span>
          <span className="text-4xl font-extrabold text-white mt-2 leading-tight">
            {mainText}
          </span>
          {subText && (
            <span className={`text-sm mt-2 ${s.sub}`}>{subText}</span>
          )}
          {ctaLabel && onCta && (
            <button
              onClick={onCta}
              disabled={ctaDisabled}
              className={`mt-4 px-5 py-2 rounded-full text-sm font-semibold shadow-md transition-colors disabled:opacity-60 ${s.cta}`}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
