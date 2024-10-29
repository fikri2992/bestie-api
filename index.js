const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {
    Server
} = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});
app.use(express.json()); // Add this line to parse JSON request body

// Image upload and processing dependencies
const multer = require('multer');
const {
    v4: uuidv4
} = require('uuid');
const sharp = require('sharp');

const PORT = process.env.PORT || 3000;

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle image uploads
    socket.on('image upload', (imageData) => {
        const imageName = `${uuidv4()}.jpg`;
        const imagePath = `uploads/${imageName}`;

        sharp(imageData)
            .resize(500, 500)
            .jpeg({
                quality: 80
            })
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

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));

// API endpoint to receive and send messages
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


server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});