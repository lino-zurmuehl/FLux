/**
 * "Meine Tagesübersicht" – horizontale Karten-Reihe im Flo-Stil.
 */

import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp } from 'lucide-react';
import type { HeroVariant } from './HeroCircle';

interface Props {
  variant: HeroVariant;
  currentCycleDay: number | null;
  confidencePercent: number | null;
  avgCycleLength: number | null;
}

const PHASE_TIPS: Record<HeroVariant, { emoji: string; title: string; tip: string; bg: string }> = {
  period: {
    emoji: '🩸',
    title: 'Periode',
    tip: 'Wärme und leichte Bewegung können Krämpfe lindern.',
    bg: 'bg-primary-50 border-primary-200',
  },
  fertile: {
    emoji: '🌱',
    title: 'Fruchtbare Phase',
    tip: 'Deine Energie ist jetzt oft am höchsten – nutze sie.',
    bg: 'bg-sky-50 border-sky-200',
  },
  overdue: {
    emoji: '⏳',
    title: 'Überfällig',
    tip: 'Stress oder Reisen können den Zyklus verschieben.',
    bg: 'bg-primary-50 border-primary-200',
  },
  default: {
    emoji: '🌙',
    title: 'Zwischenphase',
    tip: 'Guter Zeitpunkt für Routinen: Schlaf, Ernährung, Bewegung.',
    bg: 'bg-sky-50 border-sky-100',
  },
};

export function InsightsRow({
  variant,
  currentCycleDay,
  confidencePercent,
  avgCycleLength,
}: Props) {
  const navigate = useNavigate();
  const tip = PHASE_TIPS[variant];

  const cardBase =
    'flex-shrink-0 w-32 h-40 rounded-2xl border p-3 flex flex-col justify-between text-left';

  return (
    <section className="mt-6">
      <h3 className="font-semibold text-gray-800 mb-3 px-1">Meine Tagesübersicht</h3>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
        {/* Eintrag-Karte */}
        <button
          onClick={() => navigate('/log')}
          className={`${cardBase} bg-white border-sky-100 shadow-sm hover:shadow-md transition-shadow`}
        >
          <span className="text-xs font-medium text-gray-500">
            Wie geht es dir heute?
          </span>
          <div className="flex flex-col items-start gap-2">
            <span className="w-10 h-10 rounded-full bg-gradient-to-b from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
              <Plus className="w-6 h-6 text-white" />
            </span>
            <span className="text-sm font-semibold text-primary-700">
              Symptome eintragen
            </span>
          </div>
        </button>

        {/* Zyklustag-Karte */}
        {currentCycleDay !== null && (
          <div className={`${cardBase} bg-primary-50 border-primary-200`}>
            <span className="text-xs font-medium text-primary-700">Zyklustag</span>
            <div>
              <div className="text-4xl font-extrabold text-primary-700">
                {currentCycleDay}
              </div>
              {avgCycleLength !== null && (
                <div className="text-xs text-primary-600 mt-1">
                  Ø Zyklus: {Math.round(avgCycleLength)} Tage
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phasen-Tipp-Karte */}
        <div className={`${cardBase} ${tip.bg}`}>
          <div className="text-2xl">{tip.emoji}</div>
          <div>
            <div className="text-sm font-semibold text-gray-800">{tip.title}</div>
            <div className="text-xs text-gray-600 mt-1 leading-snug">{tip.tip}</div>
          </div>
        </div>

        {/* Konfidenz-Karte */}
        {confidencePercent !== null && (
          <div className={`${cardBase} bg-white border-sky-100 shadow-sm`}>
            <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <TrendingUp className="w-3.5 h-3.5" />
              Vorhersage
            </span>
            <div>
              <div className="text-3xl font-extrabold text-sky-600">
                {confidencePercent}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Konfidenz des Modells</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
