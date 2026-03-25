// ---------------------------------------------------------------------------
// Matrix Operator – Anomaly Detection Engine
// ---------------------------------------------------------------------------

import type { Anomaly, AnomalyThreatLevel, AnomalyType } from './types';

// -- Katakana characters for the Matrix feed --------------------------------

export const KATAKANA: string[] = [
  'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
  'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
  'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
  'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ',
  'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン',
];

const DIGITS = '0123456789';
const HEX_CHARS = '0123456789ABCDEF';

// -- Anomaly visual patterns ------------------------------------------------

export const ANOMALY_PATTERNS: Record<AnomalyType, string[]> = {
  pattern_break: [
    'ア1ウ3オ5キ7ケ9サ1ス3ソ5チ7テ9ナ1ヌ3ノ5ヒ7ヘ9',
    'カ0カ0カ0カ0カ0カ0カ0カ0カ0カ0カ0カ0カ0カ0カ0',
    '██░░██░░██░░██░░████████████████████████',
    'ア.ア.ア.ア.ア----ア.ア.ア.ア.ア----ア.ア',
  ],
  hidden_coords: [
    'ウ3x:4ク2y:7ソ9z:1タ0ヌ5x:12y:8z:3ホ6',
    'サ1{42.7N,83.2W}シ0ス8セ4ソ2タ6チ9ツ1テ3',
    'ラ2[LAT:34.052]リ4[LON:-118.243]ル0レ8',
    'マ5>>>COORD:N40.7128:W74.0060<<<ミ2ム7',
  ],
  color_shift: [
    '\x1b[31mア\x1b[32mイ\x1b[33mウ\x1b[34mエ\x1b[0mオカキクケコ',
    'アイウ##RED##エオカ##GRN##キクケ##BLU##コサ',
    'ア[!]イ[!]ウ[!]エ[!]オ[!]カ[!]キ[!]ク[!]ケ',
    '>>>CHROMATIC_ABERRATION<<<ア2イ4ウ6エ8オ0',
  ],
  morse_pulse: [
    'ア...---...イウ...---...エオ...---...カキ',
    '-.--./---/..-/.-../../.-../-..///ク3ケ7',
    'アSOS SOS SOSイ.-/.-./.---ウ---/.-/-.エ',
    '..././.-../.--./--/.///アイウエオカキクケコ',
  ],
};

// -- Anomaly descriptions & analysis ----------------------------------------

const ANOMALY_DESCRIPTIONS: Record<AnomalyType, string[]> = {
  pattern_break: [
    'Repeating sequence detected in sub-routine 7G. Matrix rendering stutter.',
    'Data stream shows identical packets in sequence. Possible loop injection.',
    'Construct subroutine echoing. Agent Smith may be overwriting local code.',
    'Render pipeline showing duplicate frames. Déjà vu signature detected.',
  ],
  hidden_coords: [
    'Geographic coordinates embedded in data stream. Possible safe house.',
    'Encoded location data found. Cross-referencing Zion archives.',
    'Latitude/longitude pair hidden in noise. May indicate phone booth exit.',
    'Spatial coordinates detected. Matches known extraction point geometry.',
  ],
  color_shift: [
    'Chromatic anomaly in feed. Reality mesh distortion detected.',
    'Color channel bleed in Matrix render. Possible Smith corruption.',
    'Visual spectrum shift detected. May indicate construct instability.',
    'RGB channel desync. Agent presence warping local rendering.',
  ],
  morse_pulse: [
    'Morse code pattern in data stream. Possible encoded message from inside.',
    'Rhythmic pulse detected. SOS pattern — someone is signalling.',
    'Encoded signal in carrier noise. Translating…',
    'Structured pulse in random noise. Message embedded by operator.',
  ],
};

const ANOMALY_ANALYSES: Record<AnomalyType, string[]> = {
  pattern_break: [
    'ANALYSIS: Pattern break confirms agent activity in sector. Smith is rewriting code blocks. Recommend immediate extraction.',
    'ANALYSIS: Loop injection detected — Matrix is patching around deleted data. A program was recently terminated here.',
    'ANALYSIS: Déjà vu signature is strong. The Matrix changed something. Expect environmental shifts.',
  ],
  hidden_coords: [
    'ANALYSIS: Coordinates decoded — location matches a hardline phone in the financial district. Route agents for extraction.',
    'ANALYSIS: These coordinates point to an unregistered construct. Possible Merovingian safe house.',
    'ANALYSIS: Location data indicates a backdoor access point. Could be used for infiltration.',
  ],
  color_shift: [
    'ANALYSIS: Chromatic distortion maps to Smith replication activity. He is copying himself in this sector.',
    'ANALYSIS: Color shift indicates construct boundary. We are near the edge of a loaded zone.',
    'ANALYSIS: Visual corruption is spreading. The Matrix is destabilizing in this area. Move quickly.',
  ],
  morse_pulse: [
    'ANALYSIS: Morse decoded — "THEY KNOW". An operative inside is warning us. Abort mission or change approach.',
    'ANALYSIS: Signal translates to extraction coordinates. A trapped operative is requesting pickup.',
    'ANALYSIS: Message reads "BACKDOOR OPEN". An ally has created an escape route.',
  ],
};

// -- Utility ----------------------------------------------------------------

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId(): string {
  return `anom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomThreatLevel(): AnomalyThreatLevel {
  const roll = Math.random();
  if (roll < 0.35) return 'low';
  if (roll < 0.65) return 'medium';
  if (roll < 0.85) return 'high';
  return 'critical';
}

// -- Public API -------------------------------------------------------------

/**
 * Generate a random anomaly.
 */
export function generateAnomaly(): Anomaly {
  const types: AnomalyType[] = [
    'pattern_break',
    'hidden_coords',
    'color_shift',
    'morse_pulse',
  ];
  const type = randomItem(types);
  const threatLevel = randomThreatLevel();
  const description = randomItem(ANOMALY_DESCRIPTIONS[type]);

  return {
    id: randomId(),
    type,
    detected: false,
    analyzed: false,
    threatLevel,
    description,
    timestamp: Date.now(),
  };
}

/**
 * Get a line of Matrix feed that contains the anomaly pattern.
 * The anomaly pattern is embedded within normal Matrix noise.
 */
export function getAnomalyFeedLine(anomaly: Anomaly): string {
  const pattern = randomItem(ANOMALY_PATTERNS[anomaly.type]);

  // Wrap in some normal noise
  const prefixLen = Math.floor(Math.random() * 6) + 2;
  const suffixLen = Math.floor(Math.random() * 6) + 2;
  const prefix = generateMatrixChars(prefixLen);
  const suffix = generateMatrixChars(suffixLen);

  return `${prefix}${pattern}${suffix}`;
}

/**
 * Analyse an anomaly and return the analysis text.
 */
export function analyzeAnomaly(anomaly: Anomaly): string {
  return randomItem(ANOMALY_ANALYSES[anomaly.type]);
}

/**
 * Generate a normal line of Matrix feed (no anomaly).
 * Returns a string of random katakana and digits.
 */
export function generateMatrixFeedLine(): string {
  const length = 40 + Math.floor(Math.random() * 20);
  return generateMatrixChars(length);
}

/**
 * Generate `count` random Matrix-style characters.
 */
function generateMatrixChars(count: number): string {
  let result = '';
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.3) {
      // Digit or hex char
      result += Math.random() < 0.5
        ? DIGITS[Math.floor(Math.random() * DIGITS.length)]
        : HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
    } else {
      result += KATAKANA[Math.floor(Math.random() * KATAKANA.length)];
    }
  }
  return result;
}
