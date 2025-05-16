from pathlib import Path
import platform
import subprocess

def play_sound(sound_file_path):
    """
    Play a sound file. Platform-independent.
    
    Args:
        sound_file_path (str or Path): Path to the sound file to play
    
    Returns:
        bool: True if the sound was played successfully, False otherwise
    """
    sound_file_path = Path(sound_file_path)
    
    if not sound_file_path.exists():
        print(f"Sound file not found: {sound_file_path}")
        return False
    
    system = platform.system()
    
    try:
        if system == "Darwin":  # macOS
            subprocess.call(["afplay", str(sound_file_path)])
        elif system == "Linux":
            subprocess.call(["aplay", str(sound_file_path)])
        elif system == "Windows":
            import winsound
            winsound.PlaySound(str(sound_file_path), winsound.SND_FILENAME)
        else:
            print(f"Unsupported platform: {system}")
            return False
        
        return True
    except Exception as e:
        print(f"Error playing sound: {e}")
        return False

if __name__ == "__main__":
    # Example usage
    sound_dir = Path(__file__).parent.parent / "sound"
    correct_sound = sound_dir / "correct.mp3"
    wrong_sound = sound_dir / "wrong.mp3"
    
    if correct_sound.exists():
        play_sound(correct_sound)
    else:
        print(f"Sound file not found: {correct_sound}")
    
    if wrong_sound.exists():
        play_sound(wrong_sound)
    else:
        print(f"Sound file not found: {wrong_sound}") 