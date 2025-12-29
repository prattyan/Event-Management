import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

console.debug("Gemini Service Init - API Key present:", !!apiKey, "Length:", apiKey.length);

// Initialize the API with the key
const genAI = new GoogleGenerativeAI(apiKey);

export const generateEventDescription = async (title: string, date: string, location: string): Promise<string | null> => {
  try {
    // For text-only input, use the gemini-pro or gemini-1.5-flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      You are an expert event planner. Write a compelling, professional, and exciting description for an event.
      
      Event Details:
      Title: ${title}
      Date: ${date}
      Location: ${location}

      Requirements:
      1. Two concise paragraphs engaging the potential attendee.
      2. A suggested simplified agenda (3-4 bullet points) formatted cleanly.
      3. Tone: Professional yet enthusiastic.
      4. Return ONLY the text, no markdown code blocks.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text?.trim() || null;
    return text?.trim() || null;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    let errorMessage = "Unknown error";
    if (error.message) {
      if (error.message.includes('API key expired')) errorMessage = "API Key Expired. Please update .env file.";
      else if (error.message.includes('API_KEY_INVALID')) errorMessage = "Invalid API Key.";
      else errorMessage = error.message;
    }
    return `Error: ${errorMessage}`;
  }
};

export const getEventRecommendations = async (
  pastEvents: { title: string; description: string; type: string }[],
  upcomingEvents: { id: string; title: string; description: string; date: string; type: string }[]
): Promise<string[]> => {
  if (pastEvents.length === 0 || upcomingEvents.length === 0) return [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const pastEventsContext = pastEvents.map(e => `- ${e.title} (${e.type}): ${e.description.substring(0, 100)}...`).join('\n');
    const upcomingEventsContext = upcomingEvents.map(e => `ID: ${e.id} | Title: ${e.title} (${e.type}) | Desc: ${e.description.substring(0, 100)}...`).join('\n');

    const prompt = `
      As an AI Recommender System, analyze the user's past event attendance and recommend the top 3 most relevant upcoming events.

      User's Past Events:
      ${pastEventsContext}

      Available Upcoming Events:
      ${upcomingEventsContext}

      Task:
      1. Identify patterns in the user's interests based on past events.
      2. Match these interests with the upcoming events.
      3. Return ONLY a JSON array of the top 3 matching Event IDs. Do not include any explanations or markdown formatting.
      Example Output: ["ev_123", "ev_456", "ev_789"]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const recommendedIds = JSON.parse(cleanedText);

    return Array.isArray(recommendedIds) ? recommendedIds : [];
  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    return [];
  }
};