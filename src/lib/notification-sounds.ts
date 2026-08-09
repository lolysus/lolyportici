/**
 * I suoni di notifica delle prenotazioni.
 *
 * **Licenza: nessun file audio.** Ogni suono è sintetizzato qui con la Web Audio
 * API a partire da frequenze scelte a mano — non è un campione registrato, non è
 * una melodia esistente, non arriva da nessuna libreria. È una scelta
 * deliberata: un file scaricato da una raccolta "gratuita" porta con sé una
 * licenza da verificare e un URL che un giorno non risponde più, e una
 * campanella che non suona è un cliente che aspetta al bancone.
 *
 * Il vincolo di progetto è che si sentano in sala: cucina rumorosa, telefono che
 * squilla, un tablet appoggiato al leggio. Perciò stanno tutti nella banda
 * 700–2600 Hz, dove un altoparlante piccolo rende di più, e nessuno dura oltre
 * il secondo e mezzo: un avviso lungo diventa un fastidio e viene disattivato.
 */

export interface NotificationSound {
  id: string;
  label: string;
  description: string;
  play(context: AudioContext, volume: number): void;
}

/** Una nota con inviluppo percussivo: attacco rapido e coda che si spegne. */
function strike(context: AudioContext, options: {
  at: number;
  frequency: number;
  peak: number;
  decay: number;
  type?: OscillatorType;
}) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.value = options.frequency;
  // Le rampe esponenziali non possono partire da zero: 0.0001 è silenzio a
  // tutti gli effetti e mantiene la curva valida.
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.peak), options.at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + options.decay);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(options.at);
  oscillator.stop(options.at + options.decay + 0.02);
}

/** Il volume come lo intende chi ascolta: 0–100 verso un guadagno utilizzabile. */
function level(volume: number, base: number) {
  const clamped = Math.min(100, Math.max(0, volume)) / 100;
  // Curva quadratica: l'orecchio percepisce il volume in modo logaritmico, e
  // con una scala lineare metà cursore suona già quasi al massimo.
  return base * clamped * clamped;
}

export const notificationSounds: NotificationSound[] = [
  {
    id: "campanella",
    label: "Campanella da sala",
    description: "Tre tocchi brillanti, come la campanella del passe. Il più udibile con il locale pieno.",
    play(context, volume) {
      const now = context.currentTime;
      for (const offset of [0, 0.22, 0.44]) {
        strike(context, { at: now + offset, frequency: 1046.5, peak: level(volume, 0.22), decay: 0.86 });
        strike(context, { at: now + offset, frequency: 1318.5, peak: level(volume, 0.08), decay: 0.7, type: "triangle" });
        // La quinta appena sopra dà il timbro metallico senza aggiungere volume.
        strike(context, { at: now + offset, frequency: 2093, peak: level(volume, 0.03), decay: 0.34, type: "sine" });
      }
    },
  },
  {
    id: "doppio-tocco",
    label: "Doppio tocco",
    description: "Due note discrete, una più alta dell'altra. Adatto a una sala silenziosa o a un turno di pranzo.",
    play(context, volume) {
      const now = context.currentTime;
      strike(context, { at: now, frequency: 880, peak: level(volume, 0.2), decay: 0.5 });
      strike(context, { at: now + 0.16, frequency: 1174.7, peak: level(volume, 0.22), decay: 0.62 });
      strike(context, { at: now + 0.16, frequency: 2349.3, peak: level(volume, 0.025), decay: 0.3, type: "triangle" });
    },
  },
  {
    id: "gong-morbido",
    label: "Gong morbido",
    description: "Un colpo pieno che si spegne lentamente. Si nota senza far voltare la sala.",
    play(context, volume) {
      const now = context.currentTime;
      strike(context, { at: now, frequency: 392, peak: level(volume, 0.26), decay: 1.4, type: "sine" });
      strike(context, { at: now, frequency: 784, peak: level(volume, 0.12), decay: 1.1, type: "sine" });
      strike(context, { at: now + 0.02, frequency: 1176, peak: level(volume, 0.05), decay: 0.8, type: "triangle" });
    },
  },
];

export const defaultNotificationSoundId = notificationSounds[0].id;

export function findNotificationSound(id: string | null | undefined) {
  return notificationSounds.find((sound) => sound.id === id) ?? notificationSounds[0];
}
