let budgetDay = new Date().toISOString().slice(0, 10);
let estimatedTokensToday = 0;

function estimateTokens(text = '') {
  return Math.ceil(String(text).length / 4);
}

function resetBudgetIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    estimatedTokensToday = 0;
  }
}

export async function chatCompletion({ system, messages, temperature = 0.2 }) {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!baseUrl || !apiKey || !model) throw new Error('LLM is not configured');

  resetBudgetIfNeeded();
  const dailyLimit = Number(process.env.DAILY_LLM_TOKEN_LIMIT || 150000);
  const inputEstimate = estimateTokens(system) + messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (estimatedTokensToday + inputEstimate > dailyLimit) throw new Error('daily_llm_token_limit_reached');

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: 'system', content: system }, ...messages]
    })
  });

  if (!response.ok) throw new Error(`LLM error ${response.status}: ${await response.text()}`);

  const data = await response.json();
  const output = data.choices?.[0]?.message?.content ?? '';
  const used = Number(data.usage?.total_tokens);
  estimatedTokensToday += Number.isFinite(used) ? used : inputEstimate + estimateTokens(output);
  return output;
}
