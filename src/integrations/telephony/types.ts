export interface SmsMessage { to: string; text: string }
export interface SmsResult { status: "sent" | "sandbox"; providerMessageId?: string }
export interface TelephonyAdapter { sendSms(message: SmsMessage): Promise<SmsResult> }

