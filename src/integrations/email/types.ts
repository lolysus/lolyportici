export interface EmailMessage { to: string; subject: string; html: string; text: string }
export interface EmailResult { status: "sent" | "sandbox"; providerMessageId?: string }
export interface EmailAdapter { send(message: EmailMessage): Promise<EmailResult> }

