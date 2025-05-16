import asyncio
import websockets
import base64
import json
import os
import pyaudio
import threading
import queue

# PyAudio constants
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000  # 16kHz for STT
CHUNK_SIZE = 1024 * 2  # 2048 samples per chunk

# OpenAI API details
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REALTIME_TRANSCRIPTION_URL = "wss://api.openai.com/v1/realtime?intent=transcription"

# Thread-safe queue for audio chunks
audio_queue = queue.Queue()
# Event to signal the recording thread to stop
stop_recording_event = threading.Event()
# Event to signal that speech has stopped (from VAD)
speech_stopped_event = asyncio.Event()


def _record_audio():
    """Captures audio from the microphone and puts it into a queue."""
    global audio_queue, stop_recording_event
    audio_queue = queue.Queue() # Clear queue for new session
    stop_recording_event.clear()
    
    p = pyaudio.PyAudio()
    stream = None
    try:
        stream = p.open(format=FORMAT,
                        channels=CHANNELS,
                        rate=RATE,
                        input=True,
                        frames_per_buffer=CHUNK_SIZE)
        # print("Audio recording started. Speak now.")
        while not stop_recording_event.is_set():
            try:
                data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                audio_queue.put(data)
            except IOError as e:
                if e.errno == pyaudio.paInputOverflowed:
                    print("Input overflowed. Skipping frame.")
                    continue
                else:
                    raise
            if speech_stopped_event.is_set(): # Early exit if VAD detected stop
                break
    except Exception as e:
        print(f"Error during audio recording: {e}")
    finally:
        if stream:
            stream.stop_stream()
            stream.close()
        p.terminate()
        audio_queue.put(None) # Signal end of audio stream
        # print("Audio recording stopped.")

async def _send_audio_chunks(websocket):
    """Sends audio chunks from the queue to the WebSocket."""
    while True:
        try:
            chunk = await asyncio.to_thread(audio_queue.get, timeout=0.1)
        except queue.Empty:
            if stop_recording_event.is_set() or speech_stopped_event.is_set():
                break
            continue
            
        if chunk is None: # End of stream signal
            break
        
        payload = {
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(chunk).decode('utf-8')
        }
        try:
            await websocket.send(json.dumps(payload))
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed while sending audio.")
            break
    # print("Finished sending audio chunks.")

async def _receive_transcriptions(websocket, transcript_parts):
    """Receives and processes messages from the WebSocket."""
    global speech_stopped_event
    speech_stopped_event.clear() # Reset for current session
    try:
        async for message_str in websocket:
            message = json.loads(message_str)
            # print(f"Received message: {message}") # For debugging

            if message.get("type") == "input_audio_buffer.speech_started":
                print("Speech started...")
            elif message.get("type") == "input_audio_buffer.speech_stopped":
                print("Speech stopped by VAD.")
                speech_stopped_event.set()
                # The API might send final transcriptions after speech_stopped
                # Wait a brief moment for any final transcriptions
                await asyncio.sleep(0.5) 
                break 
            elif message.get("type") == "transcription.text.delta":
                transcript_parts.append(message.get("text", ""))
            elif message.get("type") == "transcription.text.done":
                # This might contain the full transcript sometimes
                # but we are accumulating deltas
                pass # Already handled by delta
            elif message.get("type") == "error":
                print(f"Error from OpenAI: {message.get('message')}")
                speech_stopped_event.set() # Stop processing on error
                break
    except websockets.exceptions.ConnectionClosedOK:
        print("WebSocket connection closed normally.")
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"WebSocket connection closed with error: {e}")
    finally:
        speech_stopped_event.set() # Ensure loops dependent on this can exit
        # print("Finished receiving transcriptions.")


async def _record_and_transcribe_session(prompt_message: str) -> str:
    """Manages a single speech-to-text session."""
    global stop_recording_event, speech_stopped_event

    print(prompt_message)
    input("Press Enter to start speaking, then speak. Recording will stop automatically when you pause...")

    transcript_parts = []
    
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }

    session_config = {
        "type": "transcription_session.update",
        "input_audio_format": "pcm16",
        "input_audio_transcription": {
            "model": "gpt-4o-mini-transcribe", # Using mini for potentially faster response
            # "language": "en" # Optional: specify language
        },
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 200,
            "silence_duration_ms": 700 # Milliseconds of silence to detect speech stop
        }
    }

    try:
        async with websockets.connect(REALTIME_TRANSCRIPTION_URL, extra_headers=headers) as websocket:
            # print("WebSocket connection established.")
            await websocket.send(json.dumps(session_config))
            # print("Session configuration sent.")

            # Start recording in a separate thread
            recording_thread = threading.Thread(target=_record_audio)
            recording_thread.start()
            # print("Recording thread started.")

            # Start tasks for sending audio and receiving transcriptions
            send_task = asyncio.create_task(_send_audio_chunks(websocket))
            receive_task = asyncio.create_task(_receive_transcriptions(websocket, transcript_parts))

            # Wait for speech to stop or an error
            await speech_stopped_event.wait()
            # print("Speech stopped event triggered.")
            
            # Signal recording and sending to stop
            stop_recording_event.set()

            # Ensure tasks complete
            await asyncio.gather(send_task, receive_task, return_exceptions=True)
            # print("Send and receive tasks completed.")
            
            recording_thread.join(timeout=2) # Wait for recording thread to finish
            # print("Recording thread joined.")

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"WebSocket connection failed: {e.status_code} {e.headers.get('www-authenticate', '')}")
        if e.status_code == 401:
            print("Authentication error. Check your OPENAI_API_KEY.")
        return ""
    except Exception as e:
        print(f"An error occurred during the speech-to-text session: {e}")
        return ""
    finally:
        stop_recording_event.set() # Ensure it's set in all exit paths
        if 'recording_thread' in locals() and recording_thread.is_alive():
            recording_thread.join(timeout=1)


    final_transcript = "".join(transcript_parts).strip()
    print(f"Transcription: {final_transcript}")
    return final_transcript

def get_speech_input(prompt_message: str) -> str:
    """
    Gets user input via speech-to-text.
    Falls back to keyboard input if API key is missing or an error occurs.
    """
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY environment variable not set.")
        return input(prompt_message + " (Speech-to-text unavailable, fallback to keyboard): ")
    
    # Clear events for the new session
    stop_recording_event.clear()
    speech_stopped_event.clear()

    try:
        # asyncio.run can't be nested if an event loop is already running.
        # Check if an event loop is running.
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError: # 'RuntimeError: There is no current event loop...'
            loop = None

        if loop and loop.is_running():
            # This case is tricky for CLI apps. For simplicity, if a loop is running,
            # we might fall back or raise an error.
            # However, typical CLI usage won't have a persistent outer loop.
            # If needed, this would require more complex asyncio management.
            print("Detected running asyncio event loop. Speech input might behave unexpectedly or require main application to be async.")
            # For now, we'll try to run it in a new thread if absolutely necessary, or just proceed.
            # This part might need refinement based on how the main app uses asyncio, if at all.
            # Let's assume for a simple CLI it's not an issue.
            pass # Fall through to asyncio.run() which should work if no loop is current.
            
        transcript = asyncio.run(_record_and_transcribe_session(prompt_message))
        return transcript
    except RuntimeError as e:
        if " asyncio.run() cannot be called from a running event loop" in str(e):
             print("Error: Speech input cannot be called from a running asyncio event loop in this context.")
             print("Please ensure the main application structure supports this or modify speech input.")
             return input(prompt_message + " (Speech-to-text async error, fallback to keyboard): ")
        else:
            print(f"Speech input runtime error: {e}. Fallback to keyboard input.")
            return input(prompt_message + " (Fallback to keyboard): ")
    except Exception as e:
        print(f"Speech input error: {e}. Fallback to keyboard input.")
        return input(prompt_message + " (Fallback to keyboard): ") 