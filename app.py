from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from pathlib import Path
import os
from dotenv import load_dotenv

from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
# Ensure your OPENAI_API_KEY is set in your .env file
client = OpenAI()

# Assuming your utility functions are in the 'utils' directory
# and prompts are in the 'prompts' directory, relative to this script.
# Adjust these imports if your project structure is different.
from utils import (
    get_categories, choose_random_problem, 
    get_question_response, text_to_speech, 
    evaluate_answer, handle_followup_question,
    answer_feedback_tool # Assuming this is still needed or adapted
)
from prompts.prompts import system_prompt, question_prompt_template, evaluation_prompt, followup_prompt

app = Flask(__name__)
CORS(app)

# Ensure the anki package path is correct
# This might need to be configurable or determined differently in a server environment
APKG_PATH = Path(__file__).parent / "MCAT_Milesdown.apkg"

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/api/categories', methods=['GET'])
def api_get_categories():
    """API endpoint to get available categories."""
    try:
        # Check if APKG file exists - this check is implicitly handled by get_categories_from_apkg
        # if not APKG_PATH.exists():
        #     return jsonify({"error": f"Anki package file not found at {APKG_PATH}"}), 500
        
        categories = get_categories() # get_categories from choose_random_problem does not take path
        return jsonify(categories)
    except Exception as e:
        # Log the exception e for debugging
        print(f"Error in /api/categories: {e}")
        return jsonify({"error": "Failed to retrieve categories"}), 500

@app.route('/api/start_problem', methods=['POST'])
def api_start_problem():
    """API endpoint to start a new problem."""
    data = request.get_json()
    if not data or 'categories' not in data or not data['categories']:
        return jsonify({"error": "No categories selected"}), 400
    
    selected_categories = data['categories']
    # For now, let's just pick the first selected category
    # The original UI implies multiple category selection for choosing *from*, 
    # but choose_random_problem takes one deck/category.
    # We might need to adjust choose_random_problem or how we select one category from the list.
    # For simplicity, we take the first one.
    if not selected_categories:
         return jsonify({"error": "Categories list is empty after filtering."}), 400

    # The `get_categories()` function from `choose_random_problem.py` returns only sub-deck names.
    # The `choose_random_problem` function expects one of these sub-deck names.
    # So, we can randomly pick one from the user's selection if they picked multiple.
    import random
    chosen_category_for_problem = random.choice(selected_categories)

    try:
        problem = choose_random_problem(apkg_path=str(APKG_PATH), deck=chosen_category_for_problem)
        if problem is None:
            return jsonify({"error": f"No problems found in category: {chosen_category_for_problem}"}), 404
        
        question = problem['question']
        answer = problem['answer']
        
        # Commenting out the app.current_problem_data assignment as it's not the preferred way
        # app.current_problem_data = {'question': question, 'answer': answer}

        formatted_question = get_question_response(question, answer, question_prompt_template)
        audio_path = text_to_speech(formatted_question) # This now returns a web path
        
        return jsonify({
            "formatted_question": formatted_question,
            "audio_path": audio_path,
            "original_question": question, # Sending original question for later evaluation
            "original_answer": answer # Sending original answer for later evaluation
        })
    except FileNotFoundError as e:
        print(f"Error in /api/start_problem (FileNotFound): {e}")
        return jsonify({"error": str(e)}), 500
    except ValueError as e:
        print(f"Error in /api/start_problem (ValueError): {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error in /api/start_problem: {e}")
        # import traceback
        # traceback.print_exc()
        return jsonify({"error": "Failed to start problem"}), 500

@app.route('/api/transcribe_audio', methods=['POST'])
def api_transcribe_audio():
    """API endpoint to transcribe uploaded audio file."""
    if 'audio_data' not in request.files:
        return jsonify({"error": "No audio file part"}), 400
    
    audio_file_storage = request.files['audio_data']
    
    if audio_file_storage.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if audio_file_storage:
        try:
            # Pass the file-like object (stream) from FileStorage to the API
            # along with the filename, which OpenAI SDK can use for type detection.
            # The SDK expects a tuple: (filename, file_object, content_type)
            # For direct stream, just filename and stream should work, or let SDK infer.
            # Reading the file into bytes is also a robust option.
            audio_bytes = audio_file_storage.read()
            
            # The OpenAI client expects the file to be passed as a tuple (filename, file_data)
            # where file_data is bytes.
            # We need to give it a name, even if it's generic.
            transcription = client.audio.transcriptions.create(
                model="whisper-1", 
                file=(audio_file_storage.filename or "audio.webm", audio_bytes),
                response_format="text"
            )
            return jsonify({"transcript": transcription})
        except Exception as e:
            print(f"Error during transcription: {e}")
            # import traceback
            # traceback.print_exc()
            return jsonify({"error": "Failed to transcribe audio"}), 500
    
    return jsonify({"error": "File processing error"}), 500

@app.route('/api/evaluate_answer', methods=['POST'])
def api_evaluate_answer():
    """API endpoint to evaluate the user's answer."""
    data = request.get_json()
    if not data or 'original_question' not in data or \
       'original_answer' not in data or 'user_answer' not in data:
        return jsonify({"error": "Missing data for evaluation"}), 400

    original_question = data['original_question']
    original_answer = data['original_answer']
    user_answer = data['user_answer']

    try:
        # The evaluate_answer function from utils.conversation uses a specific prompt and tool.
        # Ensure prompts and tools are correctly set up and imported.
        # evaluation_prompt and answer_feedback_tool are imported from prompts.prompts and utils respectively.
        feedback = evaluate_answer(
            question=original_question, 
            user_answer=user_answer, 
            correct_answer=original_answer,
            evaluation_prompt=evaluation_prompt,
            answer_feedback_tool=answer_feedback_tool
        )
        
        # feedback is expected to be a dictionary, e.g., {"is_correct": True/False, "explanation": "..."}
        return jsonify(feedback)
    except Exception as e:
        print(f"Error in /api/evaluate_answer: {e}")
        # import traceback
        # traceback.print_exc()
        return jsonify({"error": "Failed to evaluate answer"}), 500

@app.route('/api/follow_up', methods=['POST'])
def api_follow_up():
    """API endpoint to handle a follow-up question."""
    data = request.get_json()
    if not data or 'original_question' not in data or \
       'original_answer' not in data or 'follow_up_question' not in data:
        return jsonify({"error": "Missing data for follow-up"}), 400

    original_question = data['original_question']
    original_answer = data['original_answer']
    follow_up_question_text = data['follow_up_question']

    try:
        # Ensure followup_prompt is imported from prompts.prompts
        followup_response_text = handle_followup_question(
            question=original_question,
            correct_answer=original_answer,
            followup=follow_up_question_text,
            followup_prompt=followup_prompt
        )
        
        audio_path = text_to_speech(followup_response_text)
        
        return jsonify({
            "follow_up_response": followup_response_text,
            "audio_path": audio_path
        })
    except Exception as e:
        print(f"Error in /api/follow_up: {e}")
        # import traceback
        # traceback.print_exc()
        return jsonify({"error": "Failed to get follow-up response"}), 500

if __name__ == '__main__':
    # Create static/audio directory if it doesn't exist
    static_audio_dir = Path(__file__).parent / "static" / "audio"
    static_audio_dir.mkdir(parents=True, exist_ok=True)
    
    app.run(debug=True) 