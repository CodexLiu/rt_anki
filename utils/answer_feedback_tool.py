from openai import OpenAI
import os
import dotenv
from pathlib import Path
import json
from .answer_feedback import process_answer

dotenv.load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Define the tool
answer_feedback_tool = {
    "type": "function",
    "function": {
        "name": "check_answer",
        "description": "Check if an answer is correct and provide feedback with appropriate sound",
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

def get_answer_feedback(user_question, user_answer, correct_answer):
    """
    Use the OpenAI API to determine if the user's answer is correct and provide feedback.
    
    Args:
        user_question (str): The question posed to the user
        user_answer (str): The user's answer
        correct_answer (str): The correct answer
    
    Returns:
        dict: Feedback information including correctness and explanation
    """
    # Ask the model to determine if the answer is correct
    response = client.responses.create(
        model="gpt-4.1",
        input=f"Question: {user_question}\nUser's answer: {user_answer}\nCorrect answer: {correct_answer}\nIs the user's answer correct?",
        tools=[answer_feedback_tool]
    )
    
    # Extract the tool call from the response
    if response.tool_calls:
        tool_call = response.tool_calls[0]
        if tool_call.function.name == "check_answer":
            args = json.loads(tool_call.function.arguments)
            is_correct = args.get("is_correct")
            explanation = args.get("explanation")
            
            # Process the answer and play appropriate sound
            result = process_answer(is_correct, explanation)
            return result
    
    # If no tool call was made, return default response
    return {
        "is_correct": False,
        "explanation": "Could not determine answer correctness."
    }

def handle_followup(user_followup, original_question, correct_answer):
    """
    Handle a followup question after an incorrect answer.
    
    Args:
        user_followup (str): The user's followup question
        original_question (str): The original question
        correct_answer (str): The correct answer
    
    Returns:
        str: Response to the followup
    """
    response = client.responses.create(
        model="gpt-4.1",
        input=f"Original question: {original_question}\nCorrect answer: {correct_answer}\nUser followup: {user_followup}\nProvide a concise, helpful response to the followup."
    )
    
    return response.text

if __name__ == "__main__":
    # Example usage
    question = "What is the capital of France?"
    user_answer = "Berlin"
    correct_answer = "Paris"
    
    feedback = get_answer_feedback(question, user_answer, correct_answer)
    print(json.dumps(feedback, indent=2))
    
    if not feedback.get("is_correct"):
        followup = "Why is that the correct answer?"
        followup_response = handle_followup(followup, question, correct_answer)
        print("\nFollowup response:")
        print(followup_response) 