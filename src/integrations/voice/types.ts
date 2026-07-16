export interface VoiceAgentAdapter {
  createOrUpdateAgent(prompt: string, toolUrls: string[]): Promise<{ status: "configured" | "sandbox"; agentId?: string }>;
}

