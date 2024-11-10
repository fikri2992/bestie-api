
# Bestie API

  

Bestie API is an AI-powered assistant built with Node.js and Express that interacts with Google's Generative AI models. It provides endpoints for text and image analysis, leveraging the capabilities of the Gemini model.

  

# Table of Contents

  

- [Prerequisites](#prerequisites)

- [Installation](#installation)

- [Configuration](#configuration)

- [Running the Server](#running-the-server)

- [API Endpoints](#api-endpoints)

- [POST /api/message](#post-apimessage)

- [POST /img-bestie](#postimg-bestie)

- [POST /wdyt-bestie](#postwdyt-bestie)

- [Usage Examples](#usage-examples)

- [Send a Message to Bestie](#send-a-message-to-bestie)

- [Upload Images for Analysis](#upload-images-for-analysis)

- [Upload Text and Screenshot for Analysis](#upload-text-and-screenshot-for-analysis)

- [License](#license)

  

# Prerequisites

  

-  **Node.js** (version 20 or higher)

-  **npm** (Node Package Manager)

-  **Google Cloud Account** with access to the Generative AI API

-  **Google Generative AI API Key**

  

# Installation

  

1.  **Clone the repository**:

  

```bash

git clone https://github.com/fikri2992/bestie-api

cd bestie-api
```
2. **Install dependencies**:
```bash
npm install
```
## Configuration
1.  **Create a  `.env`  file in the root directory**:

```bash
touch .env
```
2. **Add your Google Generative AI API key to the  `.env`  file**:

```env
GEMINI_API_KEY=YOUR_GOOGLE_GENERATIVE_AI_API_KEY
```
Replace `YOUR_GOOGLE_GENERATIVE_AI_API_KEY` with your actual API key.

## Running the Server

Start the server using the following command:

```bash
node gemini.js
```
## API Endpoints

### POST /api/message

Process a text message and receive a response from Bestie.

-   **URL**:  `/api/message`
    
-   **Method**:  `POST`
    
-   **Headers**:  `Content-Type: application/json`
    
-   **Body**:
    
    ```json
    {
      "text": "Your message here",
      "history": []
    }
    ```
	-   `text`: (string) The message you want to send to Bestie.
	-   `history`: (array) An array of previous messages for context (optional).
**Response**:

	```json
	{
	  "type": "text",
	  "message": "Bestie's response",
	  "stepsToDo": [...],
	  "contextFromHistory": [...],
	  "emotionalReactions": [...],
	  ...
	}
	```
### POST /img-bestie

Upload two images for analysis.

-   **URL**:  `/img-bestie`
    
-   **Method**:  `POST`
    
-   **Headers**:  `Content-Type: multipart/form-data`
    
-   **Body**:
    
    -   `image`: (file) The first image file.
    -   `screenshot`: (file) The second image file.
-   **Response**:
    
    ```json
    {
      "type": "text",
      "message": "Analysis result",
      "isInappropriate": true,
      "type": "Type of content identified",
      "sentiment": "negative",
      ...
    }
    ```
### POST /wdyt-bestie

Upload a screenshot and text for analysis.

-   **URL**:  `/wdyt-bestie`
    
-   **Method**:  `POST`
    
-   **Headers**:  `Content-Type: multipart/form-data`
    
-   **Body**:
    
    -   `text`: (string) The text message.
    -   `screenshot`: (file) The screenshot file.
-   **Response**:
    
    ```json
    {
      "type": "text",
      "message": "Analysis result",
      "isInappropriate": false,
      "type": "manipulation",
      "sentiment": "neutral",
      ...
    }
    ```
### Send a Message to Bestie

```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello Bestie!",
    "history": []
  }'
```

### Upload Images for Analysis

```bash
curl -X POST http://localhost:3000/img-bestie \
  -F "image=@/path/to/first_image.jpg" \
  -F "screenshot=@/path/to/second_image.jpg"
```

### Upload Text and Screenshot for Analysis

```bash
curl -X POST http://localhost:3000/wdyt-bestie \
  -F "text=Some text message" \
  -F "screenshot=@/path/to/screenshot.jpg"
```


## License

This project is licensed under the [MIT License](https://mit-license.org/). 


### Additional Information

- **Dependencies**: Make sure all the dependencies listed in `package.json` are installed. These include:

  - `express`
  - `http`
  - `sharp`
  - `uuid`
  - `fs`
  - `path`
  - `@google/generative-ai`
  - `multer`
  - `dotenv`

- **API Key**: To obtain the `GEMINI_API_KEY`, you need access to Google's Generative AI APIs. Follow Google's documentation to set up an API key with the necessary permissions. 

- **Environment Variables**: The application uses environment variables defined in the `.env` file. Besides `GEMINI_API_KEY`, ensure any other necessary environment variables are also defined.

- **Error Handling**: The server includes error handling for various scenarios, such as missing files or invalid inputs. Check the console output for detailed error messages during development.

- **Uploads Directory**: Uploaded files are temporarily stored in the `uploads/` directory. The application attempts to delete processed files after they are used. Ensure the application has the necessary permissions to read from and write to this directory.

**Disclaimer**: Use this project responsibly and adhere to all applicable laws and terms of service for the APIs and services used.