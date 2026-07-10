/**
 * LogEntry - Täglicher Eintrag für Symptome, Stimmung, Blutung, etc.
 * Flo-Stil: Emoji-Chips, weiche Karten, schwebender Speichern-Button.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Heart,
  Thermometer,
  Brain,
  AlertCircle,
  NotebookPen,
} from 'lucide-react';
import {
  addCycle,
  addLog,
  backupModelParamsBeforePeriodStart,
  getCycleByStartDate,
  getLatestCycle,
  getLogByDate,
  recordPredictionOutcome,
  updatePredictionForNewCycle,
} from '../lib/db';
import {
  SYMPTOMS,
  SYMPTOM_LABELS,
  MOODS,
  MOOD_LABELS,
  FLUIDS,
  FLUID_LABELS,
  DISTURBERS,
  DISTURBER_LABELS,
  SEX_DRIVES,
  SEX_DRIVE_LABELS,
  FLOW_INTENSITIES,
  type Symptom,
  type Mood,
  type Fluid,
  type Disturber,
  type SexDrive,
  type FlowIntensity,
  type DailyLog,
} from '../lib/types';
import { useApp } from '../contexts/AppContext';

const FLOW_COLORS: Record<FlowIntensity, string> = {
  spotting: 'bg-primary-100',
  light: 'bg-primary-200',
  medium: 'bg-primary-400',
  heavy: 'bg-primary-600',
};

const FLOW_DOT_SIZE: Record<FlowIntensity, string> = {
  spotting: 'w-3 h-3',
  light: 'w-4 h-4',
  medium: 'w-5 h-5',
  heavy: 'w-6 h-6',
};

// Emoji für Chips im Flo-Stil
const SYMPTOM_EMOJI: Record<Symptom, string> = {
  acne: '🫧',
  backache: '💢',
  bloating: '🎈',
  cravings: '🍫',
  cramps: '⚡',
  diarrhea: '🌀',
  fatigue: '😴',
  feel_good: '😊',
  headache: '🤕',
  insomnia: '🌙',
  tender_breasts: '💗',
};

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😄',
  energetic: '⚡',
  neutral: '😐',
  sad: '😢',
  angry: '😠',
  anxious: '😰',
  depressed: '😞',
  apathetic: '😶',
  confused: '😵‍💫',
  mood_swings: '🎭',
  self_critical: '🪞',
  feeling_guilty: '😔',
};

const FLUID_EMOJI: Record<Fluid, string> = {
  dry: '🌵',
  sticky: '🍯',
  creamy: '🥛',
  eggwhite: '🥚',
  clumpy_white: '☁️',
  bloody: '🩸',
};

const SEX_DRIVE_EMOJI: Record<SexDrive, string> = {
  none: '😴',
  low: '🙂',
  high: '🔥',
};

const DISTURBER_EMOJI: Record<Disturber, string> = {
  stress: '😫',
  alcohol: '🍷',
  illness: '🤒',
  travel: '✈️',
  poor_sleep: '🛌',
};

// Wiederverwendbare Stile
const chipBase =
  'px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5';
const chipIdle = 'bg-sky-50 text-gray-700 hover:bg-sky-100 border border-sky-100';

interface SectionProps {
  icon: typeof Droplet;
  iconClass: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, iconClass, iconBg, title, subtitle, children }: SectionProps) {
  return (
    <div className="card mb-4 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconClass}`} />
        </span>
        <div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function LogEntry() {
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    // Erlaubt Deep-Links wie /log?date=2026-07-01 (z.B. aus dem Kalender)
    const param = searchParams.get('date');
    if (param) {
      const parsed = parseISO(param);
      if (isValid(parsed) && parsed <= new Date()) return parsed;
    }
    return new Date();
  });
  const [flow, setFlow] = useState<FlowIntensity | undefined>();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [mood, setMood] = useState<Mood | undefined>();
  const [fluid, setFluid] = useState<Fluid | undefined>();
  const [sexDrive, setSexDrive] = useState<SexDrive | undefined>();
  const [disturbers, setDisturbers] = useState<Disturber[]>([]);
  const [temperature, setTemperature] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { refreshData } = useApp();

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const isToday = dateString === format(new Date(), 'yyyy-MM-dd');

  // Lade existierenden Eintrag für ausgewähltes Datum
  useEffect(() => {
    async function loadLog() {
      const log = await getLogByDate(dateString);
      if (log) {
        setFlow(log.flow);
        setSymptoms(log.symptoms || []);
        setMood(log.mood);
        setFluid(log.fluid);
        setSexDrive(log.sexDrive);
        setDisturbers(log.disturbers || []);
        setTemperature(log.temperature?.toString() ?? '');
        setNotes(log.notes ?? '');
      } else {
        // Formular für neues Datum zurücksetzen
        setFlow(undefined);
        setSymptoms([]);
        setMood(undefined);
        setFluid(undefined);
        setSexDrive(undefined);
        setDisturbers([]);
        setTemperature('');
        setNotes('');
      }
      setSaved(false);
    }
    loadLog();
  }, [dateString]);

  const toggleSymptom = (symptom: Symptom) => {
    setSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
    setSaved(false);
  };

  const toggleDisturber = (disturber: Disturber) => {
    setDisturbers((prev) =>
      prev.includes(disturber)
        ? prev.filter((d) => d !== disturber)
        : [...prev, disturber]
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const log: Omit<DailyLog, 'id'> = {
        date: dateString,
        flow,
        symptoms,
        mood,
        fluid,
        sexDrive,
        disturbers,
        temperature: temperature ? parseFloat(temperature) : undefined,
        notes: notes || undefined,
        isPeriod: !!flow,
      };
      await addLog(log);

      // If a bleed entry marks a new period start, create a cycle so cycle-day resets correctly.
      // Mid-cycle bleeding (e.g. ovulation spotting) must NOT start a new cycle,
      // so we require a plausible gap since the last period start AND ask the user.
      if (flow) {
        const existingCycle = await getCycleByStartDate(dateString);
        if (!existingCycle) {
          const latestCycle = await getLatestCycle();
          const daysSinceLastStart = latestCycle
            ? differenceInCalendarDays(new Date(dateString), new Date(latestCycle.startDate))
            : null;

          // Shortest plausible cycle; anything earlier is treated as
          // mid-cycle bleeding and only saved in the daily log.
          const MIN_DAYS_FOR_NEW_CYCLE = 18;

          const plausibleNewCycle =
            !latestCycle ||
            (Boolean(latestCycle.endDate) &&
              daysSinceLastStart !== null &&
              daysSinceLastStart >= MIN_DAYS_FOR_NEW_CYCLE);

          if (plausibleNewCycle) {
            const confirmed = window.confirm(
              'Blutung als Start einer neuen Periode erfassen?\n\n' +
                'OK = neue Periode beginnt an diesem Tag.\n' +
                'Abbrechen = nur als Blutung im Tagebuch speichern (z.B. Zwischenblutung).'
            );
            if (confirmed) {
              await backupModelParamsBeforePeriodStart();
              await recordPredictionOutcome(dateString);
              await addCycle({ startDate: dateString });
              await updatePredictionForNewCycle(dateString);
            }
          }
        }
      }

      await refreshData();
      setSaved(true);
    } catch (error) {
      console.error('Speichern fehlgeschlagen:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-36">
      {/* Datumsauswahl */}
      <div className="card p-3 mb-5 flex items-center justify-between">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-full hover:bg-sky-100 text-gray-600"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">
            {isToday ? 'Heute' : format(selectedDate, 'EEEE', { locale: de })}
          </div>
          <div className="text-sm text-gray-500">
            {format(selectedDate, 'd. MMMM yyyy', { locale: de })}
          </div>
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={isToday}
          className="p-2 rounded-full hover:bg-sky-100 text-gray-600 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Blutung */}
      <Section
        icon={Droplet}
        iconClass="text-primary-600"
        iconBg="bg-primary-50"
        title="Periodenblutung"
      >
        <div className="grid grid-cols-4 gap-2">
          {FLOW_INTENSITIES.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setFlow(flow === option.value ? undefined : option.value);
                setSaved(false);
              }}
              className={`p-3 rounded-2xl border-2 transition-all ${
                flow === option.value
                  ? 'border-primary-600 bg-primary-50 shadow-sm scale-[1.03]'
                  : 'border-sky-100 bg-white hover:border-sky-200'
              }`}
            >
              <div className="h-7 flex items-center justify-center mb-1">
                <div
                  className={`rounded-full ${FLOW_COLORS[option.value]} ${FLOW_DOT_SIZE[option.value]}`}
                />
              </div>
              <div className="text-xs font-medium text-gray-700">{option.label}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Symptome */}
      <Section
        icon={AlertCircle}
        iconClass="text-primary-500"
        iconBg="bg-primary-50"
        title="Symptome"
      >
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((symptom) => (
            <button
              key={symptom}
              onClick={() => toggleSymptom(symptom)}
              className={`${chipBase} ${
                symptoms.includes(symptom)
                  ? 'bg-primary-600 text-white shadow-sm'
                  : chipIdle
              }`}
            >
              <span>{SYMPTOM_EMOJI[symptom]}</span>
              {SYMPTOM_LABELS[symptom]}
            </button>
          ))}
        </div>
      </Section>

      {/* Stimmung */}
      <Section
        icon={Brain}
        iconClass="text-sky-600"
        iconBg="bg-sky-50"
        title="Stimmung"
      >
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => {
                setMood(mood === m ? undefined : m);
                setSaved(false);
              }}
              className={`${chipBase} ${
                mood === m ? 'bg-sky-500 text-white shadow-sm' : chipIdle
              }`}
            >
              <span>{MOOD_EMOJI[m]}</span>
              {MOOD_LABELS[m]}
            </button>
          ))}
        </div>
      </Section>

      {/* Zervixschleim */}
      <Section
        icon={Droplet}
        iconClass="text-sky-500"
        iconBg="bg-sky-50"
        title="Zervixschleim"
      >
        <div className="flex flex-wrap gap-2">
          {FLUIDS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFluid(fluid === f ? undefined : f);
                setSaved(false);
              }}
              className={`${chipBase} ${
                fluid === f ? 'bg-sky-400 text-white shadow-sm' : chipIdle
              }`}
            >
              <span>{FLUID_EMOJI[f]}</span>
              {FLUID_LABELS[f]}
            </button>
          ))}
        </div>
      </Section>

      {/* Libido */}
      <Section
        icon={Heart}
        iconClass="text-primary-500"
        iconBg="bg-primary-50"
        title="Libido"
      >
        <div className="flex flex-wrap gap-2">
          {SEX_DRIVES.map((sd) => (
            <button
              key={sd}
              onClick={() => {
                setSexDrive(sexDrive === sd ? undefined : sd);
                setSaved(false);
              }}
              className={`${chipBase} ${
                sexDrive === sd ? 'bg-primary-500 text-white shadow-sm' : chipIdle
              }`}
            >
              <span>{SEX_DRIVE_EMOJI[sd]}</span>
              {SEX_DRIVE_LABELS[sd]}
            </button>
          ))}
        </div>
      </Section>

      {/* Störfaktoren */}
      <Section
        icon={AlertCircle}
        iconClass="text-primary-400"
        iconBg="bg-primary-50"
        title="Störfaktoren"
        subtitle="Faktoren, die deinen Zyklus beeinflussen können"
      >
        <div className="flex flex-wrap gap-2">
          {DISTURBERS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDisturber(d)}
              className={`${chipBase} ${
                disturbers.includes(d) ? 'bg-primary-400 text-white shadow-sm' : chipIdle
              }`}
            >
              <span>{DISTURBER_EMOJI[d]}</span>
              {DISTURBER_LABELS[d]}
            </button>
          ))}
        </div>
      </Section>

      {/* Temperatur */}
      <Section
        icon={Thermometer}
        iconClass="text-sky-600"
        iconBg="bg-sky-50"
        title="Basaltemperatur"
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="35"
            max="40"
            placeholder="36,50"
            value={temperature}
            onChange={(e) => {
              setTemperature(e.target.value);
              setSaved(false);
            }}
            className="input flex-1"
          />
          <span className="text-gray-500">°C</span>
        </div>
      </Section>

      {/* Notizen */}
      <Section
        icon={NotebookPen}
        iconClass="text-gray-500"
        iconBg="bg-sky-50"
        title="Notizen"
      >
        <textarea
          placeholder="Zusätzliche Notizen..."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          className="input min-h-[100px] resize-none"
        />
      </Section>

      {/* Schwebender Speichern-Button */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`pointer-events-auto w-full btn flex items-center justify-center gap-2 py-3 shadow-lg ${
              saved
                ? 'bg-sky-200 text-gray-800'
                : 'bg-gradient-to-r from-primary-500 to-primary-700 text-white hover:from-primary-600 hover:to-primary-800'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-5 h-5" />
                Gespeichert
              </>
            ) : (
              <>{isSaving ? 'Speichern...' : 'Eintrag speichern'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
