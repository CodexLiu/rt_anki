import os
from pathlib import Path
import sys
from prompts.prompts import system_prompt, question_prompt_template, evaluation_prompt, followup_prompt
from utils import (
    get_categories, choose_random_problem, 
    get_question_response, text_to_speech, 
    evaluate_answer, handle_followup_question,
    answer_feedback_tool, play_sound
)
from utils.speech_to_text import get_speech_input

def main():
    """
    Main function implementing the flashcard study loop.
    """
    print("RT Anki - Real-time Anki with OpenAI")
    print("=" * 50)
    
    # Check if APKG file exists
    apkg_path = Path(__file__).parent / "MCAT_Milesdown.apkg"
    if not apkg_path.exists():
        print(f"Error: Anki package file not found at {apkg_path}")
        print("Please ensure the MCAT_Milesdown.apkg file is in the project root directory.")
        return
    
    # Main loop
    while True:
        # Print categories
        categories = get_categories()
        print("\nAvailable categories:")
        for i, category in enumerate(categories):
            print(f"{i+1}. {category}")
        
        # Get user selection
        try:
            selection_prompt = "\nSpeak the category number or say 'quit' to exit: "
            selection_text = get_speech_input(selection_prompt)
            
            if not selection_text:
                print("No input received. Please try again.")
                continue

            if selection_text.lower() == 'q' or selection_text.lower() == 'quit':
                break
            
            # Attempt to convert spoken numbers (e.g., "one", "two") or digits
            # This is a simple conversion; more robust parsing might be needed for complex cases
            num_map = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", 
                       "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"}
            processed_selection = num_map.get(selection_text.lower(), selection_text)

            category_index = int(processed_selection) - 1
            if category_index < 0 or category_index >= len(categories):
                print(f"Invalid selection. Please speak a number between 1 and {len(categories)}.")
                continue
        except ValueError:
            print("Please speak a valid number for the category selection.")
            continue
        except Exception as e:
            print(f"Error during category selection: {e}. Please try again.")
            continue
        
        # Get the selected category
        selected_category = categories[category_index]
        print(f"\nSelected category: {selected_category}")
        
        # Choose a random problem from the selected category
        try:
            problem = choose_random_problem(str(apkg_path), selected_category)
            if problem is None:
                print(f"No problems found in category: {selected_category}")
                continue
            
            question = problem['question']
            answer = problem['answer']
        except Exception as e:
            print(f"Error choosing random problem: {e}")
            continue
        
        # Get the formatted question from the LLM
        formatted_question = get_question_response(question, answer, question_prompt_template)
        
        # Print and speak the question
        print("\n" + formatted_question)
        question_audio_path = text_to_speech(formatted_question)
        
        # Explicitly play the question audio
        play_sound(question_audio_path)
        
        # Get user's answer
        user_answer_prompt = "\nYour answer (speak clearly): "
        user_answer = get_speech_input(user_answer_prompt)
        if not user_answer:
            print("No answer received. Marking as incorrect.")
            user_answer = ""
        
        # Evaluate the answer
        feedback = evaluate_answer(question, user_answer, answer, evaluation_prompt, answer_feedback_tool)
        
        # Print result
        if feedback.get("is_correct"):
            print("✓ Correct!")
        else:
            print("✗ Incorrect!")
            print(f"The correct answer is: {answer}")
            if "explanation" in feedback:
                print(f"Explanation: {feedback['explanation']}")
            
            # Ask if user wants to ask a follow-up
            followup_choice_prompt = "\nWould you like to ask a follow-up question? (Speak 'yes' or 'no'): "
            followup_choice_text = get_speech_input(followup_choice_prompt).lower()
            
            if not followup_choice_text:
                print("No choice received for follow-up.")
            elif followup_choice_text.startswith('y'):
                followup_prompt_text = "Your follow-up question (speak clearly): "
                followup = get_speech_input(followup_prompt_text)
                
                if followup:
                    # Get follow-up response
                    followup_response = handle_followup_question(
                        question, answer, followup, followup_prompt
                    )
                    
                    # Print and speak the follow-up response
                    print(f"\nResponse: {followup_response}")
                    followup_audio_path = text_to_speech(followup_response)
                    
                    # Explicitly play the follow-up response audio
                    play_sound(followup_audio_path)
                else:
                    print("No follow-up question received.")
        
        # Wait for user to continue
        input("\nPress Enter to continue to the next question...")
    
    print("\nThank you for using RT Anki!")

if __name__ == "__main__":
    main() 