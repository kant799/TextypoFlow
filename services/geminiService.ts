
import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.API_KEY || '';
// Initialize safely, though calling logic should ensure key exists before call
const ai = new GoogleGenAI({ apiKey });

export const generateText = async (
  prompt: string,
  systemInstruction: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please set REACT_APP_GEMINI_API_KEY or check environment variables.");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
};

export const generateImage = async (
  prompt: string,
  aspectRatio: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    // gemini-2.5-flash-image follows prompt instructions for aspect ratio
    // We place the aspect ratio instruction prominently in the prompt
    const enhancedPrompt = `Aspect Ratio: ${aspectRatio}\n\n${prompt}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: enhancedPrompt }
        ]
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData && part.inlineData.data) {
      return part.inlineData.data;
    }
    
    throw new Error("No image data returned from the model.");
  } catch (error: any) {
    console.error("Gemini Image Gen Error:", error);
    throw new Error(error.message || "Failed to generate image");
  }
};
