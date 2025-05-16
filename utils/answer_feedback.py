from pathlib import Path
import dotenv
import os
from openai import OpenAI
from .text_to_speech import text_to_speech
from .play_sound import play_sound

dotenv.load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def play_feedback_sound(is_correct):
    """
    Play the appropriate feedback sound based on whether the answer is correct or not.
    
    Args:
        is_correct (bool): True if the answer is correct, False otherwise
    
    Returns:
        Path: Path to the played sound file
    """
    sound_dir = Path(__file__).parent.parent / "sound"
    sound_dir.mkdir(parents=True, exist_ok=True)
    
    if is_correct:
        sound_file = sound_dir / "correct.mp3"
    else:
        sound_file = sound_dir / "wrong.mp3"
    
    # Play the sound file
    success = play_sound(sound_file)
    if not success:
        print(f"Could not play sound: {sound_file}")
    
    return sound_file

def process_answer(is_correct, explanation=None):
    """
    Process an answer, play the appropriate sound, and handle follow-up if needed.
    
    Args:
        is_correct (bool): True if the answer is correct, False otherwise
        explanation (str, optional): Explanation if the answer is incorrect
    
    Returns:
        dict: Dictionary with feedback information
    """
    sound_file = play_feedback_sound(is_correct)
    
    result = {
        "is_correct": is_correct,
        "sound_played": str(sound_file)
    }
    
    if not is_correct and explanation:
        result["explanation"] = explanation
        # Convert explanation to speech as well
        speech_file = text_to_speech(explanation)
        result["explanation_audio"] = str(speech_file)
        
        # Play the explanation audio
        play_sound(speech_file)
    
    return result

# Tool definition that can be exposed to an AI agent
answer_feedback_tool_definition = {
    "type": "function",
    "function": {
        "name": "process_answer",
        "description": "Process a student's answer, play appropriate feedback sound, and handle follow-up if needed",
        "parameters": {
            "type": "object",
            "properties": {
                "is_correct": {
                    "type": "boolean",
                    "description": "Whether the answer is correct or not"
                },
                "explanation": {
                    "type": "string",
                    "description": "Brief explanation if the answer is incorrect"
                }
            },
            "required": ["is_correct"]
        }
    }
}

if __name__ == "__main__":
    # Example usage
    result = process_answer(False, "The correct answer is 42 because it's the ultimate answer to life, the universe, and everything.")
    print(result) 