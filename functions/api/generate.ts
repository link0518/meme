interface Env {
    GEMINI_API_KEY: string;
    ACCESS_PASSWORD: string;
    API_BASE_URL?: string;
    MODEL_ID?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;

    try {
        // 1. Parse Request Body
        const body = await request.json() as any;
        const { password, imageBase64, mimeType, mode } = body;

        // 2. Security Check: Validate Password
        // console.log(`[Auth Debug] Received: '${password}', Expected: '${env.ACCESS_PASSWORD}'`);

        if (!env.ACCESS_PASSWORD) {
            return new Response(JSON.stringify({ error: "Server misconfigured: ACCESS_PASSWORD not set" }), { status: 500 });
        }

        if (password !== env.ACCESS_PASSWORD) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid Password" }), { status: 401 });
        }

        // 3. Prepare Gemini API Call
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server misconfigured: GEMINI_API_KEY not set" }), { status: 500 });
        }

        const baseUrl = env.API_BASE_URL || "https://generativelanguage.googleapis.com";
        const model = env.MODEL_ID || "gemini-2.0-flash-exp";

        // Construct URL
        let fetchUrl = baseUrl.trim().replace(/\/+$/, "");
        if (!fetchUrl.endsWith("/chat/completions")) {
            if (fetchUrl.endsWith("/v1")) {
                fetchUrl += "/chat/completions";
            } else {
                fetchUrl += "/v1/chat/completions";
            }
        }

        let systemPrompt = "";

        if (mode === 'christmas-hat') {
            systemPrompt = `
Generate a single image based on the input image.
Add a Christmas hat to the character's head in the input image.
Ensure the hat matches the existing art style and lighting.
Return a single image.
Do not generate a sticker sheet or grid.
`;
        } else {
            // Default: Sticker Pack
            systemPrompt = `
Generate a sticker sheet featuring a Chibi-style, LINE sticker-like character based on the input image.
The character should maintain key features like headwear from the original image.
Style: Hand-drawn color illustration.
Layout: 4x6 grid (24 stickers total).
Content: Various common chat expressions and fun memes.
Language: All text must be in Handwritten Simplified Chinese.
Do not just copy the original image. Create expressive, stylized stickers.
`;
        }

        // Log the URL for debugging
        // console.log(`[Proxy] Requesting Upstream URL: ${fetchUrl}`);
        // console.log(`[Proxy] Model: ${model}`);

        const payload = {
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: systemPrompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`
                            }
                        }
                    ]
                }
            ],
            stream: true
        };

        // 4. Call Gemini API
        const response = await fetch(fetchUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({ error: `Upstream API Error: ${response.status}`, details: errorText }), { status: response.status });
        }

        // Pass-through the stream
        return new Response(response.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
