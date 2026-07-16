import "server-only";

import type { VoiceAgentAdapter } from "@/integrations/voice/types";

export class RetellAdapter implements VoiceAgentAdapter {
  async createOrUpdateAgent(prompt: string, toolUrls: string[]) {
    const apiKey = process.env.RETELL_API_KEY;
    const agentId = process.env.RETELL_AGENT_ID;
    if (!apiKey || !agentId) { console.info("[retell:sandbox] agent configuration prepared", { toolCount: toolUrls.length }); return { status: "sandbox" as const }; }
    const response = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ general_prompt: prompt, tools: toolUrls.map((url) => ({ type: "custom", url })) }),
    });
    if (!response.ok) throw new Error(`Retell error ${response.status}`);
    return { status: "configured" as const, agentId };
  }
}

