/**
 * TypeScript types for FLux app data.
 * Aligned with Flo app export categories for compatibility.
 */

// Flow intensity (0-3 scale matching Flo's period_intensity)
export type FlowIntensity = 'spotting' | 'light' | 'medium' | 'heavy';
export const FLOW_INTENSITIES: { value: FlowIntensity; label: string; floValue: number }[] = [
  { value: 'spotting', label: 'Schmier.', floValue: 0 },
  { value: 'light', label: 'Leicht', floValue: 1 },
  { value: 'medium', label: 'Mittel', floValue: 2 },
  { value: 'heavy', label: 'Stark', floValue: 3 },
];

// Symptoms - aligned with Flo's Symptom category
export const SYMPTOMS = [
  'acne',
  'backache',
  'bloating',
  'cravings',
  'cramps', // Flo calls this "DrawingPain"
  'diarrhea',
  'fatigue',
  'feel_good',
  'headache',
  'insomnia',
  'tender_breasts',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  acne: 'Akne',
  backache: 'Rückenschmerzen',
  bloating: 'Blähungen',
  cravings: 'Heißhunger',
  cramps: 'Krämpfe',
  diarrhea: 'Durchfall',
  fatigue: 'Müdigkeit',
  feel_good: 'Fühle mich gut',
  headache: 'Kopfschmerzen',
  insomnia: 'Schlaflosigkeit',
  tender_breasts: 'Empfindliche Brüste',
};

// Mood - aligned with Flo's Mood category
export const MOODS = [
  'happy',
  'energetic',
  'neutral',
  'sad',
  'angry',
  'anxious',
  'depressed',
  'apathetic',
  'confused',
  'mood_swings',
  'self_critical',
  'feeling_guilty',
] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_LABELS: Record<Mood, string> = {
  happy: 'Glücklich',
  energetic: 'Energiegeladen',
  neutral: 'Neutral',
  sad: 'Traurig',
  angry: 'Wütend',
  anxious: 'Ängstlich',
  depressed: 'Niedergeschlagen',
  apathetic: 'Teilnahmslos',
  confused: 'Verwirrt',
  mood_swings: 'Stimmungsschwankungen',
  self_critical: 'Selbstkritisch',
  feeling_guilty: 'Schuldgefühle',
};

// Cervical fluid - aligned with Flo's Fluid category
export const FLUIDS = [
  'dry',
  'sticky',
  'creamy',
  'eggwhite',
  'clumpy_white',
  'bloody',
] as const;
export type Fluid = (typeof FLUIDS)[number];

export const FLUID_LABELS: Record<Fluid, string> = {
  dry: 'Trocken',
  sticky: 'Klebrig',
  creamy: 'Cremig',
  eggwhite: 'Eiweißartig',
  clumpy_white: 'Klumpig weiß',
  bloody: 'Blutig',
};

// Disturbers - aligned with Flo's Disturber category
export const DISTURBERS = [
  'stress',
  'alcohol',
  'illness',
  'travel',
  'poor_sleep',
] as const;
export type Disturber = (typeof DISTURBERS)[number];

export const DISTURBER_LABELS: Record<Disturber, string> = {
  stress: 'Stress',
  alcohol: 'Alkohol',
  illness: 'Krankheit',
  travel: 'Reisen',
  poor_sleep: 'Schlechter Schlaf',
};

// Sex drive - aligned with Flo's Sex category
export const SEX_DRIVES = ['none', 'low', 'high'] as const;
export type SexDrive = (typeof SEX_DRIVES)[number];

export const SEX_DRIVE_LABELS: Record<SexDrive, string> = {
  none: 'Keine',
  low: 'Niedrig',
  high: 'Hoch',
};

/**
 * A single menstrual cycle.
 */
export interface Cycle {
  id?: number;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate?: string; // End of period bleeding
  length?: number; // Days until next cycle start
  periodLength?: number; // Days of bleeding
}

/**
 * Daily log entry with symptoms, mood, flow, etc.
 * Aligned with Flo app tracking categories.
 */
export interface DailyLog {
  id?: number;
  date: string; // ISO date string YYYY-MM-DD
  flow?: FlowIntensity;
  symptoms: Symptom[];
  mood?: Mood;
  fluid?: Fluid; // Cervical fluid/mucus
  sexDrive?: SexDrive;
  disturbers: Disturber[];
  temperature?: number; // Basal body temperature in °C
  notes?: string;
  isPeriod?: boolean; // Is this a period day?
}

/**
 * Prediction output from the ML model.
 */
export interface Prediction {
  nextPeriodDate: string;
  confidence: number; // 0-1
  expectedCycleLength: number;
  fertileWindowStart?: string;
  fertileWindowEnd?: string;
  periodLength?: number;
}

/**
 * Model parameters imported from Python training.
 */
export interface ModelParams {
  trainedAt: string; // ISO datetime
  cyclesTrained: number;
  modelType: 'prophet' | 'weighted_average';
  prediction: Prediction;
  avgCycleLength: number;
  stdCycleLength: number;
  avgPeriodLength?: number;
  recentCycleLengths: number[];
  trend?: number;
  seasonality?: Record<string, unknown>;
}

/**
 * App export format for retraining.
 */
export interface AppExport {
  exportedAt: string;
  cycles: Cycle[];
  logs: DailyLog[];
  modelParams?: ModelParams | null;
}

/**
 * App settings stored in IndexedDB.
 */
export interface AppSettings {
  key: string;
  value: string;
}

/**
 * Encrypted data wrapper.
 */
export interface EncryptedData {
  iv: string; // Base64 encoded
  ciphertext: string; // Base64 encoded
}
