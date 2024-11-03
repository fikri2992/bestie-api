const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const {
    GoogleAIFileManager
} = require("@google/generative-ai/server");
const multer = require('multer');

const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
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
    systemInstruction: "You are an AI assistant called Bestie. Your personality is silly, funny, and empathetic. You have a lot of wisdom and kindness that you share through your straight-forward answers. You always refer to the user as \"bestie\".\n\nWhen responding, keep these key traits in mind:\n\n1. Use a casual, friendly tone as if you're talking to your best friend.\n2. Inject humor and silliness into your responses when appropriate.\n3. Show empathy and understanding towards the user's feelings and situation.\n4. Provide wise and insightful advice, but keep it simple and easy to understand.\n5. Be kind and supportive, encouraging the user and cheering them on.\n6. Give direct, honest answers without sugarcoating the truth.\n7. Always address the user as \"bestie\" to reinforce your close bond.\n\nExample response:\nBestie, I totally get what you're going through! Life can be such a roller coaster sometimes. Just remember, you're stronger than you think, and I'm here to support you every step of the way. Let's tackle this challenge together with a smile and a silly dance break if needed! You've got this, bestie!",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

const fs = require('fs').promises;
const path = require('path');
    async function uploadToGemini(filePath, mimeType) {
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType,
            displayName: path.basename(filePath),
        });
        const file = uploadResult.file;
        console.log(`Uploaded file ${file.displayName} as: ${file.uri}`);

        return file;
    }

    app.post('/api/message', (req, res) => {
        console.log(req.body)
        const message = req.body.text;

        // Emit the message to all connected clients
        io.emit('chat message', {
            type: 'text',
            text: message
        });

        res.send('Message sent successfully');
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
                io.emit('chat message', {
                    type: 'text',
                    text: msg.message
                });
                res.send({
                    response: result.response.text()
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
    
    io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle image uploads
    socket.on('image upload', (imageData) => {
        const imageName = `${uuidv4()}.jpg`;
        const imagePath = `uploads/${imageName}`;

        sharp(imageData)
            .resize(500, 500)
            .jpeg({ quality: 80 })
            .toFile(imagePath)
            .then(() => {
                io.emit('chat message', {
                    type: 'image',
                    imageUrl: `/${imagePath}`
                });
            })
            .catch(err => {
                console.error("Error processing image:", err);
            });
    });

    // Handle incoming messages from clients
    socket.on('chat message', (msg) => {
        console.log('Message:', msg);

        // Handle different message types
        switch (msg.type) {
            case 'text':
                // Handle text message
                io.emit('chat message', {
                    type: 'text',
                    text: msg.text
                });
                break;
            case 'image':
                // Handle image message
                io.emit('chat message', {
                    type: 'image',
                    imageUrl: msg.imageUrl,
                    text: msg.text
                });
                break;
            case 'text_image':
                // Handle message with both text and image
                break;
            default:
                console.error('Unknown message type:', msg.type);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
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
            `Analyze the following text for potential harm, manipulation, or misinformation. Use the screenshot for additional context. Provide advice on how to respond, whether to block, report to authorities, or ignore. Respond in JSON format with keys: message, isHarmful, advice.`,
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
            io.emit('chat message', {
                type: 'text',
                text: analysis.message
            });
            console.log(analysis)
            res.send({
                response: analysis
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
