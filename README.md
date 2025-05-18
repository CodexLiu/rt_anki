## RT Anki - Real-Time Spaced Repetition Study Tool

This application allows you to study flashcards using real-time voice input and AI-powered feedback. It's designed to work with Anki .apkg files.

### Prerequisites

*   Python 3.7+
*   An OpenAI API Key

### Setup Instructions

1.  **Download Deck:**
    *   Download the Anki deck file you wish to study. For example, the **MCAT Milesdown** deck is a popular choice.
    *   You can typically find such decks by searching online (e.g., "MCAT Milesdown anki deck download").
    *   Place the downloaded `.apkg` file (e.g., `MCAT_Milesdown.apkg`) into the root directory of this project.

2.  **Set OpenAI API Key:**
    *   You will need an API key from OpenAI to use the transcription and evaluation features.
    *   Create a file named `.env` in the root directory of this project (if it doesn't already exist).
    *   Add your OpenAI API key to the `.env` file in the following format:
        ```
        OPENAI_API_KEY='your_openai_api_key_here'
        ```
    *   Replace `'your_openai_api_key_here'` with your actual API key.

3.  **Install Dependencies:**
    *   It is highly recommended to use a virtual environment.
        ```bash
        python3 -m venv venv
        source venv/bin/activate  # On Windows use `venv\Scripts\activate`
        ```
    *   Install the required Python packages:
        ```bash
        pip install -r requirements.txt
        ```

### Running the Application

1.  **Ensure your virtual environment is activated** (if you created one).

2.  **Run the Flask application:**
    ```bash
    python app.py
    ```

3.  **Access the application:**
    *   Once the server is running, it will typically output a local URL, usually something like:
        `* Running on http://127.0.0.1:5000/`
    *   Open this URL in your web browser to start using RT Anki.

### How to Use

1.  When you first open the application, you may see an informational popup with tips for audio transcription. Click "Got it!" to dismiss.
2.  Select the categories from your Anki deck that you wish to study.
3.  Click the "Start Study Session" button.
4.  A question will be presented and read aloud.
5.  Hold the "Hold to Record Answer" button to record your answer. Release it when you're done.
6.  Your answer will be transcribed and evaluated.
7.  You'll receive feedback on whether your answer was correct and see the correct answer and an explanation if you were incorrect.
8.  You can ask follow-up questions or proceed to the "Next Question".
9.  Use the "Home" icon in the top-right (once a session starts) to return to the category selection screen.

### Notes

*   The application uses `sessionStorage` to show the initial informational popup only once per browser session.
*   Make sure your microphone is enabled in your browser settings for this site. 