const express = require('express');
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const multer = require('multer');

const app = express();
const port = 3000;

// Configure multer for image uploads
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

const apiKey = ""; // Replace with your actual API key
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

async function uploadToGemini(path, mimeType) {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: path,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

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

        res.send({ response: response.response.text() });
    } catch (err) {
        console.error("Error during chat:", err);
        res.status(500).send({ error: "Failed to process chat" });
    }
});

app.listen(port, () => {
    console.log(`Express server listening at http://localhost:${port}`);
});