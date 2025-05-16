from pathlib import Path
from openai import OpenAI
import os
import dotenv
import time

dotenv.load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def text_to_speech(text, model="gpt-4o-mini-tts", voice="alloy", speed=3.0):
    """
    Convert text to speech using OpenAI's TTS API and save to static/audio.
    
    Args:
        text (str): The text to convert to speech
        model (str, optional): The TTS model to use. Default is "gpt-4o-mini-tts".
        voice (str, optional): The voice to use. Default is "alloy".
        speed (float, optional): The speed of the generated audio, from 0.25 to 4.0. Default is 1.0.
                               Note: Does not work with gpt-4o-mini-tts model.
        
    Returns:
        str: Web-accessible path to the generated audio file (e.g., /static/audio/speech_timestamp.mp3)
    """
    # Generate a unique filename using a timestamp
    timestamp = int(time.time() * 1000)
    filename = f"speech_{timestamp}.mp3"
    
    # Define the output path within the static/audio directory
    static_audio_dir = Path(__file__).parent.parent / "static" / "audio"
    output_path = static_audio_dir / filename
    
    # Ensure the directory exists
    static_audio_dir.mkdir(parents=True, exist_ok=True)
    
    with client.audio.speech.with_streaming_response.create(
        model=model,
        voice=voice,
        input=text,
        speed=speed,
        instructions="Speak quickly and efficiently as if trying to get through many questions in minimal time."
    ) as response:
        response.stream_to_file(output_path)
    
    # Return a web-accessible path
    return f"/static/audio/{filename}"


if __name__ == "__main__":
    # Example usage
    speech_web_path = text_to_speech("The quick brown fox jumped over the lazy dog.")
    print(f"Audio saved to web path: {speech_web_path}")
    # To access this in a browser if Flask is serving the static folder:
    # print(f"Access at: http://localhost:5000{speech_web_path}") 