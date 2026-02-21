/**
 * LogEntry - Täglicher Eintrag für Symptome, Stimmung, Blutung, etc.
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, ChevronLeft, ChevronRight, Droplet, Heart, Thermometer, Brain, AlertCircle } from 'lucide-react';
import { addCycle, addLog, getCycleByStartDate, getLatestCycle, getLogByDate, updatePredictionForNewCycle } from '../lib/db';
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

export function LogEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date());
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
      if (flow) {
        const existingCycle = await getCycleByStartDate(dateString);
        if (!existingCycle) {
          const latestCycle = await getLatestCycle();
          const shouldStartNewCycle =
            !latestCycle ||
            (latestCycle.endDate && dateString > latestCycle.startDate);

          if (shouldStartNewCycle) {
            await addCycle({ startDate: dateString });
            await updatePredictionForNewCycle(dateString);
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
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Datumsauswahl */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-lg hover:bg-sky-100"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <div className="text-lg font-semibold">
            {format(selectedDate, 'EEEE', { locale: de })}
          </div>
          <div className="text-gray-500">
            {format(selectedDate, 'd. MMMM yyyy', { locale: de })}
          </div>
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={
            format(selectedDate, 'yyyy-MM-dd') ===
            format(new Date(), 'yyyy-MM-dd')
          }
          className="p-2 rounded-lg hover:bg-sky-100 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Blutung */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Droplet className="w-5 h-5 text-primary-600" />
          <h3 className="font-medium">Periodenblutung</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {FLOW_INTENSITIES.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setFlow(flow === option.value ? undefined : option.value);
                setSaved(false);
              }}
              className={`p-3 rounded-lg border-2 transition-colors ${
                flow === option.value
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-sky-200 hover:border-sky-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full mx-auto mb-1 ${FLOW_COLORS[option.value]}`}
              />
              <div className="text-xs">{option.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Symptome */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-primary-500" />
          <h3 className="font-medium">Symptome</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((symptom) => (
            <button
              key={symptom}
              onClick={() => toggleSymptom(symptom)}
              className={`px-3 py-2 rounded-full text-sm transition-colors ${
                symptoms.includes(symptom)
                  ? 'bg-primary-600 text-white'
                  : 'bg-sky-100 text-gray-700 hover:bg-sky-200'
              }`}
            >
              {SYMPTOM_LABELS[symptom]}
            </button>
          ))}
        </div>
      </div>

      {/* Stimmung */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-5 h-5 text-sky-600" />
          <h3 className="font-medium">Stimmung</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => {
                setMood(mood === m ? undefined : m);
                setSaved(false);
              }}
              className={`px-3 py-2 rounded-full text-sm transition-colors ${
                mood === m
                  ? 'bg-sky-500 text-white'
                  : 'bg-sky-100 text-gray-700 hover:bg-sky-200'
              }`}
            >
              {MOOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Zervixschleim */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Droplet className="w-5 h-5 text-sky-400" />
          <h3 className="font-medium">Zervixschleim</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {FLUIDS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFluid(fluid === f ? undefined : f);
                setSaved(false);
              }}
              className={`px-3 py-2 rounded-full text-sm transition-colors ${
                fluid === f
                  ? 'bg-sky-400 text-white'
                  : 'bg-sky-100 text-gray-700 hover:bg-sky-200'
              }`}
            >
              {FLUID_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Libido */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5 text-primary-500" />
          <h3 className="font-medium">Libido</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEX_DRIVES.map((sd) => (
            <button
              key={sd}
              onClick={() => {
                setSexDrive(sexDrive === sd ? undefined : sd);
                setSaved(false);
              }}
              className={`px-3 py-2 rounded-full text-sm transition-colors ${
                sexDrive === sd
                  ? 'bg-primary-500 text-white'
                  : 'bg-sky-100 text-gray-700 hover:bg-sky-200'
              }`}
            >
              {SEX_DRIVE_LABELS[sd]}
            </button>
          ))}
        </div>
      </div>

      {/* Störfaktoren */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-primary-400" />
          <h3 className="font-medium">Störfaktoren</h3>
        </div>
        <p className="text-xs text-gray-500 mb-2">Faktoren, die deinen Zyklus beeinflussen können</p>
        <div className="flex flex-wrap gap-2">
          {DISTURBERS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDisturber(d)}
              className={`px-3 py-2 rounded-full text-sm transition-colors ${
                disturbers.includes(d)
                  ? 'bg-primary-400 text-white'
                  : 'bg-sky-100 text-gray-700 hover:bg-sky-200'
              }`}
            >
              {DISTURBER_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* Temperatur */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Thermometer className="w-5 h-5 text-sky-600" />
          <h3 className="font-medium">Basaltemperatur</h3>
        </div>
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
      </div>

      {/* Notizen */}
      <div className="card mb-4">
        <h3 className="font-medium mb-3">Notizen</h3>
        <textarea
          placeholder="Zusätzliche Notizen..."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          className="input min-h-[100px] resize-none"
        />
      </div>

      {/* Speichern-Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className={`w-full btn flex items-center justify-center gap-2 ${
          saved ? 'btn-secondary' : 'btn-primary'
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
  );
}
