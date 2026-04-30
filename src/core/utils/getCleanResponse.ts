export async function getCleanResponse(response: string){
  return response
    .trim()
    .replace(/^```json/i, "")
    .replace(/```$/i, "")
    .replace(/\\_/g, "_")
    .replace('```', "")
    .replace('```json', "")
    .trim();
}