// Responses API text extraction shared by article generation, scoring and research.
export function getResponseText(data) {
  return data.output_text || data.output?.flatMap(item=>item.content||[]).find(part=>part.type==='output_text')?.text || '';
}
