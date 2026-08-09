/** `from` assente significa "usa il mittente globale `EMAIL_FROM`". */
export interface EmailMessage { to: string; from?: string; subject: string; html: string; text: string }
export interface EmailResult { status: "sent" | "sandbox"; providerMessageId?: string }
export interface EmailAdapter { send(message: EmailMessage): Promise<EmailResult> }

