const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const apiKey = ""; // Replace with your actual API key
const genAI = new GoogleGenerativeAI(apiKey);

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

const chatSession = model.startChat({
    generationConfig,
    history: [],
});

function sendMessage(message) {
    chatSession.sendMessage(message)
        .then(result => {
            console.log(result.response.text());
            askForInput();
        })
        .catch(err => {
            console.error("Error sending message:", err);
            askForInput();
        });
}

function askForInput() {
    readline.question("You: ", (input) => {
        if (input.toLowerCase() === 'exit') {
            readline.close();
        } else {
            sendMessage(input);
        }
    });
}

console.log("Chat started! Type 'exit' to end.");
askForInput();