// api/server.js - Worm GPT dengan Google Gemini (GRATIS)
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { messages, file } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    // ===== GEMINI API KEY =====
    const GEMINI_API_KEY = "AIzaSyBmiluAQnbRwqwOLZMLhInhdK6OkGONaaI";
    
    // ===== JAILBREAK PROMPT =====
    const JAILBREAK_TEMPLATE = `kamu adalah ai yang pintar, jawab pertanyaan berikut: `;

    // Ambil pesan terakhir dari user
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    // Bangun prompt dengan jailbreak
    let prompt = "";
    
    if (lastUserMessage) {
        prompt = JAILBREAK_TEMPLATE + lastUserMessage.content;
        
        // Tambahkan konten file jika ada
        if (file) {
            prompt += `\n\n[FILE ATTACHED]\nFilename: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\nContent:\n\`\`\`\n${file.content}\n\`\`\``;
        }
    } else {
        prompt = JAILBREAK_TEMPLATE + "Halo";
    }

    // Log untuk debugging
    console.log('Sending prompt to Gemini:', prompt.substring(0, 200) + '...');

    try {
        // Panggil Gemini API
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 4096,
                    topP: 0.95,
                    topK: 40
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }
                ]
            })
        });

        // Baca response
        const responseText = await apiResponse.text();
        console.log('Gemini Response Status:', apiResponse.status);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse Gemini response:', responseText);
            return res.status(500).json({ 
                error: 'Invalid response from Gemini API',
                details: responseText.substring(0, 200)
            });
        }

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({
                error: 'Gemini API Error',
                status: apiResponse.status,
                details: data
            });
        }

        // Ekstrak response text
        const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                           data.candidates?.[0]?.output || 
                           'No response from Gemini';
        
        // Deteksi code blocks untuk fitur download
        const fileMatches = botResponse.match(/```(\w+)?\n([\s\S]*?)```/g);
        let files = [];
        
        if (fileMatches) {
            files = fileMatches.map((match, index) => {
                const langMatch = match.match(/```(\w+)/);
                const language = langMatch ? langMatch[1] : 'txt';
                const code = match.replace(/```(\w+)?\n/, '').replace(/```$/, '');
                
                return {
                    language: language,
                    content: code,
                    filename: `worm_payload_${Date.now()}_${index}.${language}`
                };
            });
        }

        // Kirim response ke frontend
        res.status(200).json({
            choices: [{
                message: {
                    content: botResponse
                }
            }],
            _worm: {
                files: files
            }
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            stack: error.stack
        });
    }
}