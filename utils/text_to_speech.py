from pathlib import Path
from openai import OpenAI
import os
import dotenv

dotenv.load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def text_to_speech(text, output_path=None, model="gpt-4o-mini-tts", voice="alloy", speed=3.0):
    """
    Convert text to speech using OpenAI's TTS API.
    
    Args:
        text (str): The text to convert to speech
        output_path (str or Path, optional): Path to save the audio file. If None, saves to "speech.mp3" in the sound directory.
        model (str, optional): The TTS model to use. Default is "gpt-4o-mini-tts".
        voice (str, optional): The voice to use. Default is "alloy".
        speed (float, optional): The speed of the generated audio, from 0.25 to 4.0. Default is 1.0.
                               Note: Does not work with gpt-4o-mini-tts model.
        
    Returns:
        Path: Path to the generated audio file
    """
    if output_path is None:
        output_path = Path(__file__).parent.parent / "sound" / "speech.mp3"
    else:
        output_path = Path(output_path)
    
    # Ensure the directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with client.audio.speech.with_streaming_response.create(
        model=model,
        voice=voice,
        input=text,
        speed=speed,
        instructions="Speak quickly and efficiently as if trying to get through many questions in minimal time."
    ) as response:
        response.stream_to_file(output_path)
    
    return output_path


if __name__ == "__main__":
    # Example usage
    speech_path = text_to_speech("The quick brown fox jumped over the lazy dog.")
    print(f"Audio saved to: {speech_path}") 