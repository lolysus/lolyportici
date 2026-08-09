/**
 * La ricevuta della prenotazione come immagine.
 *
 * Non c'è email di conferma: il codice esiste solo sullo schermo del cliente.
 * Uno screenshot lo salverebbe insieme alla barra del browser e a mezza
 * interfaccia, e su un telefono con il carattere grande taglia via proprio il
 * codice. Qui l'immagine viene disegnata a misura, con dentro solo la ricevuta.
 *
 * È disegnata su `<canvas>` a mano invece che con una libreria di cattura
 * schermo per tre motivi che contano più dell'eleganza del codice: nessuna
 * dipendenza nuova, nessuna richiesta di rete (la pagina gira sotto una policy
 * che le blocca), e un risultato identico su ogni telefono invece di dipendere
 * da come quel browser rende il CSS.
 */

export interface ReceiptData {
  reservationCode: string;
  restaurantName: string;
  restaurantCity: string;
  dateLabel: string;
  timeLabel: string;
  partyLabel: string;
  tableLabel?: string;
  guestName: string;
  punctualityNotice: string;
  accentColor: string;
  logoUrl?: string;
  /** Etichette già tradotte: la ricevuta non conosce le lingue. */
  labels: {
    title: string;
    code: string;
    restaurant: string;
    date: string;
    time: string;
    party: string;
    table: string;
    guest: string;
    punctuality: string;
  };
}

/** Grande abbastanza da restare leggibile ingrandita, leggera abbastanza da condividerla. */
const WIDTH = 1080;
const PADDING = 72;

export function receiptFileName(reservationCode: string) {
  // Il nome del file è la prima cosa che il cliente vede nella galleria: il
  // codice va lì, non in un "download (3).png".
  const safe = reservationCode.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `prenotazione-${safe || "conferma"}.png`;
}

async function loadLogo(url: string | undefined) {
  if (!url) return null;
  try {
    const image = new Image();
    // Il logo è servito dallo stesso dominio: senza questo il canvas
    // risulterebbe "sporcato" e `toBlob` fallirebbe silenziosamente.
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    return image;
  } catch {
    // Una ricevuta senza logo è ancora una ricevuta valida: meglio di nessuna.
    return null;
  }
}

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawReceipt(data: ReceiptData): Promise<Blob | null> {
  const rows: Array<[string, string]> = [
    [data.labels.restaurant, `${data.restaurantName} · ${data.restaurantCity}`],
    [data.labels.date, data.dateLabel],
    [data.labels.time, data.timeLabel],
    [data.labels.party, data.partyLabel],
    ...(data.tableLabel ? [[data.labels.table, data.tableLabel] as [string, string]] : []),
    [data.labels.guest, data.guestName],
  ];

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = "400 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const noticeLines = data.punctualityNotice.trim() ? wrap(measure, data.punctualityNotice.trim(), WIDTH - PADDING * 2 - 48) : [];

  const logo = await loadLogo(data.logoUrl);
  const logoHeight = logo ? 96 : 0;
  const headerHeight = 96 + logoHeight + 56;
  const codeBlockHeight = 200;
  const rowsHeight = rows.length * 92;
  const noticeHeight = noticeLines.length ? 40 + noticeLines.length * 40 + 48 : 0;
  const height = headerHeight + codeBlockHeight + rowsHeight + noticeHeight + PADDING * 2;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.round(height);
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  // La striscia colorata è l'unico punto in cui il marchio della sede si vede
  // a colpo d'occhio in galleria, fra decine di altre immagini.
  context.fillStyle = data.accentColor;
  context.fillRect(0, 0, canvas.width, 12);

  let y = PADDING + 24;

  if (logo) {
    const ratio = logo.width / logo.height || 1;
    const drawnWidth = Math.min(logoHeight * ratio, 320);
    context.drawImage(logo, PADDING, y, drawnWidth, logoHeight);
    y += logoHeight + 40;
  }

  context.fillStyle = "#8a857c";
  context.font = "500 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  context.fillText(data.labels.title.toUpperCase(), PADDING, y);
  y += 56;

  context.fillStyle = "#111111";
  context.font = "600 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  context.fillText(data.restaurantName, PADDING, y);
  y += 56;

  // Il codice è il motivo per cui questa immagine esiste: sta in un riquadro
  // suo, grande, e in un carattere in cui zero e lettera O non si confondono.
  context.strokeStyle = data.accentColor;
  context.lineWidth = 3;
  context.strokeRect(PADDING, y, WIDTH - PADDING * 2, 148);
  context.fillStyle = "#8a857c";
  context.font = "500 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  context.fillText(data.labels.code.toUpperCase(), PADDING + 32, y + 46);
  context.fillStyle = "#111111";
  context.font = '700 64px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  context.fillText(data.reservationCode, PADDING + 32, y + 116);
  y += 148 + 52;

  for (const [label, value] of rows) {
    context.strokeStyle = "#e8e4dc";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(PADDING, y - 28);
    context.lineTo(WIDTH - PADDING, y - 28);
    context.stroke();

    context.fillStyle = "#8a857c";
    context.font = "400 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    context.fillText(label, PADDING, y + 4);
    context.fillStyle = "#111111";
    context.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    context.fillText(value, PADDING + 300, y + 6);
    y += 92;
  }

  if (noticeLines.length) {
    y += 12;
    const boxTop = y - 20;
    const boxHeight = 32 + noticeLines.length * 40 + 24;
    context.fillStyle = "#f6f4ef";
    context.fillRect(PADDING, boxTop, WIDTH - PADDING * 2, boxHeight);
    context.fillStyle = data.accentColor;
    context.fillRect(PADDING, boxTop, 6, boxHeight);
    context.fillStyle = "#6f6a62";
    context.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    context.fillText(data.labels.punctuality.toUpperCase(), PADDING + 32, boxTop + 40);
    context.fillStyle = "#3a3833";
    context.font = "400 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    let noticeY = boxTop + 82;
    for (const line of noticeLines) {
      context.fillText(line, PADDING + 32, noticeY);
      noticeY += 40;
    }
  }

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export type ReceiptOutcome = "downloaded" | "shared" | "opened" | "failed";

/**
 * Consegna la ricevuta con la via migliore che il dispositivo offre.
 *
 * L'ordine non è casuale. Su iOS il `download` di un link viene ignorato dentro
 * molte webview, quindi la condivisione nativa — che salva in Foto — arriva
 * prima. Su desktop il download è la cosa attesa. Se nessuna delle due
 * funziona, l'immagine si apre in una scheda: brutta come soluzione, ma il
 * cliente può ancora tenerla premuta e salvarla, che è l'unica cosa che conta.
 */
export async function deliverReceipt(blob: Blob, fileName: string): Promise<ReceiptOutcome> {
  const file = new File([blob], fileName, { type: "image/png" });
  const navigatorWithShare = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (typeof navigatorWithShare.share === "function" && navigatorWithShare.canShare?.({ files: [file] })) {
    try {
      await navigatorWithShare.share({ files: [file], title: fileName });
      return "shared";
    } catch (error) {
      // Annullare la condivisione è una scelta dell'utente, non un guasto: non
      // ripieghiamo su un download che non ha chiesto.
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    return "downloaded";
  } catch {
    const opened = window.open(url, "_blank", "noopener");
    return opened ? "opened" : "failed";
  } finally {
    // Revoca rinviata: revocare subito annulla il download appena avviato.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
