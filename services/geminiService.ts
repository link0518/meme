import { ApiConfig } from "../types";

// Helper to convert File to Base64 (Raw base64 data without prefix)
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const parts = base64String.split(",");
      const base64Data = parts.length > 1 ? parts[1] : base64String;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to extract image URL from content
const extractImageFromContent = (content: string): string => {
  if (!content) {
    throw new Error("API 返回了空内容");
  }

  // 1. Try to extract markdown image link: ![alt](url)
  const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
  if (imageMatch && imageMatch[1]) {
    return imageMatch[1];
  }

  // 2. Check if the content itself looks like a URL
  const trimmed = content.trim();
  if (trimmed.startsWith("http") || trimmed.startsWith("data:image")) {
    return trimmed;
  }

  // 3. Fallback
  throw new Error("未在响应中检测到生成的图片。请确保模型返回了图片链接或 Base64 数据。");
};

// Default Prompt (English instructions work better for complex formatting on v3 models)
const DEFAULT_PROMPT = `
Generate a sticker sheet featuring a Chibi-style, LINE sticker-like character based on the input image.
The character should maintain key features like headwear from the original image.
Style: Hand-drawn color illustration.
Layout: 4x6 grid (24 stickers total).
Content: Various common chat expressions and fun memes.
Language: All text must be in Handwritten Simplified Chinese.
Do not just copy the original image. Create expressive, stylized stickers.
`;

// --- Backend API Implementation ---
export const generateStickerPackOpenAI = async (
  imageFile: File,
  config: { password: string; mode?: 'sticker-pack' | 'christmas-hat' }
): Promise<string> => {

  const base64Image = await fileToGenerativePart(imageFile);
  const mimeType = imageFile.type;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: config.password,
        imageBase64: base64Image,
        mimeType: mimeType,
        mode: config.mode || 'sticker-pack'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as any).error || `请求失败 (${response.status})`);
    }

    if (!response.body) throw new Error("API 响应没有内容体");

    // SSE Stream Parsing
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
        if (trimmedLine === "data: [DONE]") continue;

        try {
          const jsonStr = trimmedLine.substring(6);
          const json = JSON.parse(jsonStr);
          const deltaContent = json.choices?.[0]?.delta?.content;
          if (deltaContent) fullContent += deltaContent;
        } catch (e) {
          // ignore parse errors for partial chunks
        }
      }
    }

    return extractImageFromContent(fullContent);

  } catch (error: any) {
    console.error("Generation Error:", error);
    throw error;
  }
};