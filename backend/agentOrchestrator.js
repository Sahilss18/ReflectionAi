const Groq = require('groq-sdk');
const prompts = require('./prompts');
const { searchContext } = require('./ragService');

// Handle multiple API keys
const apiKeys = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);

// Rate limiting: 10 seconds between API calls per key
const lastCallTimes = new Map();
apiKeys.forEach(k => lastCallTimes.set(k, 0));

class AgentOrchestrator {
  constructor(sessionId, customRoles) {
    this.sessionId = sessionId;
    this.roles = Array.isArray(customRoles) && customRoles.length > 0 ? customRoles : ['General Panelist'];
    this.chatHistory = [];
  }

  async processTranscript(transcriptChunk) {
    // 1. Search RAG context
    const context = await searchContext(this.sessionId, transcriptChunk);
    
    // 2. Decide if an AI should interrupt/respond
    // Randomly pick an actor from the custom roles array
    const roleIndex = Math.floor(Math.random() * this.roles.length);
    const activeRole = this.roles[roleIndex];
    
    // Map the actor directly to a dedicated API key (bound by index)
    const assignedKeyIndex = roleIndex % apiKeys.length;
    const apiKey = apiKeys[assignedKeyIndex];
    
    if (!apiKey) {
      console.error("No API key available!");
      return null;
    }
    
    // Rate limit check (5 seconds delay per key)
    const now = Date.now();
    const lastCallTime = lastCallTimes.get(apiKey) || 0;
    if (now - lastCallTime < 5000) {
      // Too soon for this API key, skip interruption to avoid 429
      console.log(`[Rate Limit] Skipping AI interruption for ${activeRole} (requires 5s wait)`);
      return null;
    }
    
    // Update last call time for this key
    lastCallTimes.set(apiKey, now);
    
    const groq = new Groq({ apiKey });

    // Fetch the exact instructions from prompts.js
    const systemPrompt = prompts[activeRole] || `You are an AI panelist acting as a "${activeRole}". You are evaluating a live presentation. Act fully in character.`;

    const messages = [
      { role: "system", content: `${systemPrompt}\n\nYou are part of a synchronized panel of human judges. The ONLY judges in this room are: ${this.roles.join(', ')}. Do NOT invent, mention, or introduce any other people. You must evaluate the presenter based strictly on their uploaded document.\n\nContext extracted from their uploaded document:\n${context}\n\nRule: Be EXTREMELY concise. Maximum 2 sentences. React naturally to what the user just said. If the presenter strays off-topic from the document context, aggressively question them. Actively listen to the other judges in the chat history, and build upon their questions or politely disagree with them to create a realistic, synced discussion.` }
    ];

    // Append last 6 messages from chat history (Sliding Window for Token Optimization)
    const recentHistory = this.chatHistory.slice(-6);
    recentHistory.forEach(msg => {
      if (msg.speaker === 'User') {
        messages.push({ role: "user", content: msg.text });
      } else {
        // Tag previous AI responses with their role so the current LLM knows who said it
        messages.push({ role: "assistant", content: `[${msg.speaker}]: ${msg.text}` });
      }
    });

    // Finally append the current chunk from the user
    messages.push({ role: "user", content: transcriptChunk });

    try {
      const completion = await groq.chat.completions.create({
        messages,
        model: "llama-3.1-8b-instant", // Updated from decommissioned model
        temperature: 0.7,
        max_tokens: 100, // Keep responses short
      });

      const responseText = completion.choices[0]?.message?.content || "";
      const tokensUsed = completion.usage?.total_tokens || 0;
      
      console.log(`[Token Usage] Model used ${tokensUsed} tokens for this response. (Groq Free Tier limits apply)`);

      this.chatHistory.push({ speaker: 'User', text: transcriptChunk });
      this.chatHistory.push({ speaker: activeRole, text: responseText });

      return {
        role: activeRole,
        text: responseText
      };
    } catch (error) {
      console.error("Groq API error:", error);
      // Fallback or rate limit handling
      return null;
    }
  }
}

const orchestrators = new Map();

function getOrchestrator(sessionId, customRoles) {
  if (!orchestrators.has(sessionId)) {
    orchestrators.set(sessionId, new AgentOrchestrator(sessionId, customRoles));
  }
  return orchestrators.get(sessionId);
}

module.exports = {
  getOrchestrator
};
