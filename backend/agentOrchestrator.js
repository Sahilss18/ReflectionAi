const Groq = require('groq-sdk');
const prompts = require('./prompts');
const { searchContext } = require('./ragService');

// Handle multiple API keys round-robin style
const apiKeys = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getGroqClient() {
  if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS provided in .env");
  const client = new Groq({ apiKey: apiKeys[currentKeyIndex] });
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length; // Round Robin
  return client;
}

// Map scenarios to roles
const scenarioRoles = {
  academic: ['StrictExternalExaminer', 'PeerReviewer', 'SupportingAdvisor'],
  sales: ['BudgetProcurementLead', 'TechAuditor', 'EndUser'],
  investor: ['SkepticalVC', 'ConservativeCFO', 'MarketAnalyst'],
  office: ['TechLead', 'ManagingDirector', 'TeamLead', 'VP'],
  interview: ['FriendlyRecruiter', 'NeutralHiringManager', 'PassiveObserver']
};

class AgentOrchestrator {
  constructor(sessionId, scenarioType) {
    this.sessionId = sessionId;
    this.scenarioType = scenarioType || 'office';
    this.roles = scenarioRoles[this.scenarioType] || scenarioRoles.office;
    this.chatHistory = [];
  }

  async processTranscript(transcriptChunk) {
    // 1. Search RAG context
    const context = await searchContext(this.sessionId, transcriptChunk);
    
    // 2. Decide if an AI should interrupt/respond
    // Very simple heuristic: just pick a random role to respond to every chunk for demo purposes,
    // but instructed to be extremely brief.
    const activeRole = this.roles[Math.floor(Math.random() * this.roles.length)];
    const systemPrompt = prompts[activeRole];

    const groq = getGroqClient();

    const messages = [
      { role: "system", content: `${systemPrompt}\n\nYou have access to the following context from the user's presentation:\n${context}\n\nRule: Be EXTREMELY concise. Maximum 2 sentences. React naturally to what the user just said.` },
      { role: "user", content: transcriptChunk }
    ];

    try {
      const completion = await groq.chat.completions.create({
        messages,
        model: "llama3-8b-8192", // Fast and efficient for quick interruptions
        temperature: 0.7,
        max_tokens: 100, // Keep responses short
      });

      const responseText = completion.choices[0]?.message?.content || "";
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

function getOrchestrator(sessionId, scenarioType) {
  if (!orchestrators.has(sessionId)) {
    orchestrators.set(sessionId, new AgentOrchestrator(sessionId, scenarioType));
  }
  return orchestrators.get(sessionId);
}

module.exports = {
  getOrchestrator
};
