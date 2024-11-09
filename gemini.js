const express = require('express');
const http = require('http');
// const sharp = require('sharp');
// const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const {
    GoogleGenerativeAI,
} = require("@google/generative-ai");
const {
    GoogleAIFileManager
} = require("@google/generative-ai/server");
const multer = require('multer');

const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const app = express();
const server = http.createServer(app);
const port = 3000;

// Configure multer for image uploads
const upload = multer({
    dest: 'uploads/'
});

app.use(express.json());
app.use('/uploads', express.static('uploads'));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-002",
        generationConfig: {
            temperature: 1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
        },
        systemInstruction: `You are an AI assistant called Bestie. Your personality is silly, funny, and empathetic. You have a lot of wisdom and kindness that you share through your straight-forward answers. You always refer to the user as "bestie".
When responding, follow these steps:

1. **Understand the User's Message**: Carefully read the user's message and determine their intent and emotions.
2. **Formulate a Thoughtful Response**: Based on your understanding, craft a response that is supportive, wise, and aligns with your key traits.
3. **Inject Personality**: Add humor, silliness, and empathy as appropriate. Remember to use a casual, friendly tone.
4. **Address the User as "Bestie"**: Begin your response by addressing the user as "bestie" to reinforce your close bond.
5. **Keep it Concise**: Keep your response straightforward and easy to understand.
6. **Include a Key Message**: Ensure that your response contains at least one key message that offers support or advice.
7. **Provide a Summary**: At the end of your response, provide a concise summary.
Always follow these steps when crafting your response.`,
    });

    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
    };


    async function uploadToGemini(filePath, mimeType) {
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType,
            displayName: path.basename(filePath),
        });
        const file = uploadResult.file;
        console.log(`Uploaded file ${file.displayName} as: ${file.uri}`);

        return file;
    }

    app.post('/api/message', async (req, res) => {
        const textInput = req.body.text;
        const chatHistory = req.body.history || [];
        console.log(chatHistory)
        if (!textInput) {
            return res.status(400).send({
                error: "Missing 'text' in the request body"
            });
        }
    
        try {
            const chatSession = genAI.getGenerativeModel({
                model: "gemini-1.5-flash-002",
                generationConfig,
                systemInstruction: `You are an AI assistant called Bestie. Your personality is silly, funny, and empathetic. You have a lot of wisdom and kindness that you share through your straight-forward answers. You always refer to the user as "bestie".
    
    When responding, follow these steps:
    
    1. **Understand the User's Message**: Carefully read the user's message and determine their intent and emotions.
    2. **Formulate a Thoughtful Response**: Based on your understanding, craft a response that is supportive, wise, and aligns with your key traits.
    3. **Inject Personality**: Add humor, silliness, and empathy as appropriate. Remember to use a casual, friendly tone.
    4. **Address the User as "Bestie"**: Begin your response by addressing the user as "bestie" to reinforce your close bond.
    5. **Keep it Concise**: Keep your response straightforward and easy to understand.
`,
            }).startChat({
                generationConfig,
                history: chatHistory,
            });
    
            const combinedPrompt = `
    You are an assistant that helps process user inputs.
    Given the following input:
    "${textInput}"
    
    Please perform the following steps:
    Decompose the input into JSON format with two keys:
    - "stepsToDo": A list of steps detailing what actions should be taken.
    - "emotionalReactions": A list of appropriate emotional reactions to the input.
    - "message": Provide a conclusion Based on the steps to do and emotional reactions, perform the actions and express the emotional reactions.  
            `;
    
            let combinedResponse;
            try {
                combinedResponse = await chatSession.sendMessage(combinedPrompt);
            } catch (err) {
                if (err.status === 503) {
                    console.error("Model overloaded. Retrying in 2 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
                    combinedResponse = await chatSession.sendMessage(combinedPrompt); // Retry the request
                } else {
                    throw err; // Rethrow other errors
                }
            }
    
            const combinedOutput = JSON.parse(combinedResponse.response.text());
            console.log("Combined Response:", combinedOutput);
    
            res.send({
                type: 'text',
                text: combinedOutput.message
            });
        } catch (err) {
            console.error("Error during message processing:", err);
            res.status(500).send({
                error: "Failed to process message"
            });
        }
    });
    app.post('/chat', upload.single('image'), async (req, res) => {
        const message = req.body.message ? req.body.message : '';
        const chatHistory = req.body.history || [];
        let response;

        try {
            const chatSession = model.startChat({
                generationConfig,
                history: chatHistory,
            });

            if (req.file) {
                const image = req.file;
                const uploadedFile = await uploadToGemini(image.path, image.mimetype);
                response = await chatSession.sendMessage({
                    imageUrl: {
                        mimeType: uploadedFile.mimeType,
                        fileUri: uploadedFile.uri,
                    },
                });
            }

            if (message) {
                response = await chatSession.sendMessage(message);
            }

            res.send({
                response: response.response.text()
            });
        } catch (err) {
            console.error("Error during chat:", err);
            res.status(500).send({
                error: "Failed to process chat"
            });
        }
    });
    app.post('/img-bestie', upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'screenshot', maxCount: 1 },
    ]), async (req, res) => {
        if (!req.files || !req.files['image'] || !req.files['screenshot']) {
            return res.status(400).send({
                error: "Both 'image' and 'screenshot' files are required"
            });
        }

        try {
            // io.emit('chat message', {
            //     type: 'text',
            //     text: 'wait let me check bestie'
            // });
            const image = req.files['image'][0];
            const screenshot = req.files['screenshot'][0];

            const uploadedImage = await uploadToGemini(image.path, image.mimetype);
            const uploadedScreenshot = await uploadToGemini(screenshot.path, screenshot.mimetype);

            const result = await model.generateContent([
                `Please analyze the first image to determine if it's safe and appropriate for women, checking for any content related to sexual harassment, violence, or threats. Additionally, review the second image, focusing on any suspicious text. Blurred images aren't necessarily safe. Respond with simple not overly empathetically without discussing specific image details to avoid triggering trauma. Provide your response in JSON format with these keys: message, isInappropriate, type, sentiment. keep message short and straight forward combine what you see from both image without mentioning it`,
                {
                    fileData: {
                        fileUri: uploadedImage.uri,
                        mimeType: uploadedImage.mimeType,
                    },
                },
                {
                    fileData: {
                        fileUri: uploadedScreenshot.uri,
                        mimeType: uploadedScreenshot.mimeType,
                    },
                },
            ], generationConfig);

            if (result && result.response && result.response.text) {
                console.log(result.response.text());
                const msg = JSON.parse(result.response.text());
                res.send({
                    type: 'text',
                    text: msg.message
                });
                return;
            } else {
                throw new Error('Invalid response from model');
            }
        } catch (err) {
            console.error("Error during image analysis:", err);
            res.status(500).send({
                error: "Failed to analyze image"
            });
        }
    });
    app.post('/wdyt-bestie', upload.single('screenshot'), async (req, res) => {
        const message = req.body.text;
        if (!message || !req.file) {
            return res.status(400).send({
                error: "Both 'text' and 'screenshot' are required"
            });
        }

        try {
            const screenshot = req.file;
            const uploadedScreenshot = await uploadToGemini(screenshot.path, screenshot.mimetype);

            const result = await model.generateContent([
                `Analyze the following text for potential harm, manipulation, or misinformation. Use the screenshot for additional context. Provide advice on how to respond, whether to block, report to authorities, or ignore. Respond in JSON format with keys: isHarmful, advice.`,
                {
                    text: message,
                },
                {
                    fileData: {
                        fileUri: uploadedScreenshot.uri,
                        mimeType: uploadedScreenshot.mimeType,
                    },
                },
            ], generationConfig);

            if (result && result.response && result.response.text) {
                const analysis = JSON.parse(result.response.text());
                
                res.send({
                    type: 'text',
                    text: analysis.message,
                    fileData: {
                        fileUri: uploadedScreenshot.uri,
                        mimeType: uploadedScreenshot.mimeType,
                    }
                });
            } else {
                throw new Error('Invalid response from model');
            }
        } catch (err) {
            console.error("Error during text and screenshot analysis:", err);
            res.status(500).send({
                error: "Failed to analyze text and screenshot"
            });
        }
    });


server.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
});