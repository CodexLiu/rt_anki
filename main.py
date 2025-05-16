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
            selection = input("\nSelect a category (number) or 'q' to quit: ")
            if selection.lower() == 'q':
                break
            
            category_index = int(selection) - 1
            if category_index < 0 or category_index >= len(categories):
                print(f"Invalid selection. Please enter a number between 1 and {len(categories)}.")
                continue
        except ValueError:
            print("Please enter a valid number.")
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
        user_answer = input("\nYour answer: ")
        
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
            followup_choice = input("\nWould you like to ask a follow-up question? (y/n): ")
            if followup_choice.lower() == 'y':
                followup = input("Your follow-up question: ")
                
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
        
        # Wait for user to continue
        input("\nPress Enter to continue to the next question...")
    
    print("\nThank you for using RT Anki!")

if __name__ == "__main__":
    main() 