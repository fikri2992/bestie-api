const express = require('express');
const http = require('http');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const {
    GoogleGenerativeAI,
    SchemaType
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
const schema = {
        message: {
            type: SchemaType.STRING,
            description: "message to be sent to the user",
            nullable: false,
        },
        required: ["message"],
    }

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

    function validateChatHistory(history) {
        if (history.length === 0) {
            return history;
        }

        // Ensure the first message is from 'user'
        if (history[0].role !== 'user') {
            history.shift(); // Remove the first message if not from 'user'
        }

        // Remove any consecutive messages from the same role
        const validatedHistory = [history[0]];
        for (let i = 1; i < history.length; i++) {
            if (history[i].role !== history[i - 1].role) {
                validatedHistory.push(history[i]);
            }
            // If the role is the same as the previous one, skip this message
        }
        return validatedHistory;
    }
    app.post('/api/message', async (req, res) => {
        const textInput = req.body.text;
        const chatHistory = req.body.history || [];
        // console.log history in console in full detail even nested objects
        // console.log(JSON.stringify(chatHistory))
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
    6. **when user say that or referencing something vague use latest history as reference**
    7. **always check latest history for context**
    Respond in JSON format: { message: 'Your message', isInappropriate: true/false, type: 'harm/manipulation/misinformation', sentiment: 'positive/negative/neutral' }

`,
            }).startChat({
                generationConfig,
                history: validateChatHistory(chatHistory),
            });
    
            const combinedPrompt = `
    You are an assistant that helps process user inputs.
    Given the following input:
    "${textInput}"
    
    Please perform the following steps:
    Decompose the input into JSON format with two keys:
    - "stepsToDo": A list of steps detailing what actions should be taken.
    - "contextFromHistory": A list of context items from the chat history that related to this conversation.
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
                text: combinedOutput.message,
                ...combinedOutput
            });
        } catch (err) {
            console.error("Error during message processing:", err);
            res.status(500).send({
                error: "Failed to process message"
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
            const image = req.files['image'][0];
            const screenshot = req.files['screenshot'][0];

            // Function to verify and convert images
            async function processImage(file) {
                let filePath = file.path;
                let mimeType = file.mimetype;
                console.log("Processing File:", filePath);
                console.log("MIME Type:", mimeType);

                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    throw new Error(`File does not exist: ${filePath}`);
                }

                // Check file size
                const fileStats = fs.statSync(filePath);
                if (fileStats.size === 0) {
                    throw new Error(`File is empty: ${filePath}`);
                }

                // Supported input formats
                const supportedInputFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/svg+xml'];

                if (!supportedInputFormats.includes(mimeType)) {
                    console.log(`Unsupported MIME type: ${mimeType}. Attempting to process as raw input.`);

                    // Attempt to read the file buffer and process it with sharp
                    const fileBuffer = fs.readFileSync(filePath);

                    // Check if buffer is valid
                    if (!fileBuffer || fileBuffer.length === 0) {
                        throw new Error(`Failed to read file buffer: ${filePath}`);
                    }

                    // Generate a new file path
                    const newFilePath = `uploads/${uuidv4()}.jpg`;

                    try {
                        await sharp(fileBuffer)
                            .toFormat('jpeg')
                            .toFile(newFilePath);
                        filePath = newFilePath;
                        mimeType = 'image/jpeg';
                    } catch (err) {
                        console.error("Error converting file to JPEG with buffer:", err);
                        throw new Error(`Failed to convert file to JPEG: ${filePath}`);
                    }
                }

                return { filePath, mimeType };
            }

            // Process the image and screenshot
            const processedImage = await processImage(image);
            const processedScreenshot = await processImage(screenshot);

            // Now upload the processed images to Gemini
            const uploadedImage = await uploadToGemini(processedImage.filePath, processedImage.mimeType);
            const uploadedScreenshot = await uploadToGemini(processedScreenshot.filePath, processedScreenshot.mimeType);
            // **Delete the processed image files from the 'uploads/' directory**
            try {
                fs.unlinkSync(processedImage.filePath);
                fs.unlinkSync(processedScreenshot.filePath);
                console.log('Processed images deleted from uploads/');
            } catch (err) {
                console.error('Error deleting processed images:', err);
            }
            // Continue with your logic...
            const result = await model.generateContent([
                `**Instructions**:
            **Goal is to help woman decide to reveal blurred first image and better inform about the image without harming woman's safety.**
    1. **Analyze the First Image**:
    - Assess the image for safety and appropriateness for women.
    - Specifically check for any content related to:
        - Sexual harassment
        - Violence
        - Threats
        - Manipulation
        - Overall women's safety concerns

    2. **Analyze the Second Image**:
    - Focus on any suspicious context external to the image content.
    - second image is just context of current active tab for more information
    - ignore label of the image if any since it's sometimes irrelevant

    3. **Important Notes**:
    - Blurred images are not necessarily safe; include them in your assessment.
    - Do **not** mention any specific details of the images in your response to avoid triggering trauma. if the image is unsafe, mention that it is unsafe. and please mention as detail as possible if it's safe
                
    4. **Response Guidelines**:
    - Combine your findings from both images into a single, concise, and straightforward message. without mentioning how many images
    - Use a simple tone.
    - Avoid overly empathetic or emotionally charged language.

    5. Provide your response in JSON format with the following keys:
    - **message**: Your combined message.
    - **isInappropriate**: "true" if any inappropriate content is found, "false" otherwise.
    - **type**: The type of content identified (e.g., "harassment", "violence", "threat", "suspicious text").
    - **sentiment**: Your assessment of the sentiment (e.g., "negative", "neutral", "positive").

    Respond in JSON format: { message: 'Your message', isInappropriate: true/false, type: 'harm/manipulation/misinformation', sentiment: 'positive/negative/neutral' }
`,
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

            // Handle the result...
            if (result && result.response && result.response.text) {
                console.log(result.response.text());
                const msg = JSON.parse(result.response.text());
                res.send({
                    type: 'text',
                    text: msg.message,
                    ...msg,
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
                    // **Delete the processed image files from the 'uploads/' directory**
            try {
                fs.unlinkSync(screenshot.filePath);
                console.log('Processed images deleted from uploads/');
            } catch (err) {
                console.error('Error deleting processed images:', err);
            }
            const result = await model.generateContent([
                `Analyze the following text highlighted. Use the screenshot for additional context of infromation to be analized add details whenever possible. Provide advice on how to respond, whether to block, report to authorities, or ignore. Respond in JSON format: 
                { message: 'Your message', isInappropriate: true/false, type: 'harm/manipulation/misinformation', sentiment: 'positive/negative/neutral' }`,
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
                console.log(analysis);
                
                res.send({
                    type: 'text',
                    text: analysis.message,
                    fileData: {
                        fileUri: uploadedScreenshot.uri,
                        mimeType: uploadedScreenshot.mimeType,
                    },
                    ...analysis
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