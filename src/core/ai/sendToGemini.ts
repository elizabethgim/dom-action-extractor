import {  GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY});

export async function sendToGemini(prompt: string, image:string[]) {
  const contents = [];

  for(const img of image){
    contents.push(imageToContent(img));
  }
  
  contents.push({ text: prompt });

  console.log(contents);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents
  });
  if(!response) throw new Error("");
  
  console.log(response.text);
  
  return response.text;
}

function imageToContent(image: string){
  return {
    inlineData: {
      mimeType: "image/png",
      data: image,
    },
  };
}