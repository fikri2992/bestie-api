const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const apiUrl = 'http://localhost:3000/chat';

// Test with a text message
async function testTextMessage() {
    try {
        const response = await axios.post(apiUrl, {
            message: 'Hello, how are you?',
        });
        console.log('Text message response:', response.data);
    } catch (error) {
        console.error('Error testing text message:', error.message);
    }
}

// Test with an image
async function testImageUpload() {
    try {
        const form = new FormData();
        form.append('image', fs.createReadStream('/path/to/image.jpg'));
        form.append('message', 'What is in this image?');

        const response = await axios.post(apiUrl, form, {
            headers: form.getHeaders(),
        });
        console.log('Image upload response:', response.data);
    } catch (error) {
        console.error('Error testing image upload:', error.message);
    }
}

// Run the tests
testTextMessage();
testImageUpload();