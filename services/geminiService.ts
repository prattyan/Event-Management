import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.API_KEY || '';
// Initialize the API with the key
const genAI = new GoogleGenerativeAI(apiKey);

export const generateEventDescription = async (title: string, date: string, location: string): Promise<string | null> => {
  try {
    // For text-only input, use the gemini-pro or gemini-1.5-flash model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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