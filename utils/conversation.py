from openai import OpenAI
import os
import dotenv
import json
from .answer_feedback import process_answer

dotenv.load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class Conversation:
    def __init__(self, system_prompt):
        """
        Initialize a conversation with a system prompt.
        
        Args:
            system_prompt (str): The system prompt to use for the conversation
        """
        self.system_prompt = system_prompt
        self.messages = []
        self.add_message("system", system_prompt)
    
    def add_message(self, role, content):
        """
        Add a message to the conversation.
        
        Args:
            role (str): The role of the message sender ("system", "user", or "assistant")
            content (str): The content of the message
        """
        self.messages.append({"role": role, "content": content})
    
    def get_response(self, tools=None):
        """
        Get a response from the OpenAI API based on the conversation history.
        
        Args:
            tools (list, optional): List of tools to make available to the model
            
        Returns:
            The response from the OpenAI API
        """
        kwargs = {
            "model": "gpt-4.1",
            "messages": self.messages
        }
        
        if tools:
            kwargs["tools"] = tools
        
        response = client.chat.completions.create(**kwargs)
        
        # Add the model's response to the conversation history
        self.add_message("assistant", response.choices[0].message.content)
        
        return response
    
    def reset(self):
        """
        Reset the conversation to just the system prompt.
        """
        self.messages = [{"role": "system", "content": self.system_prompt}]

def get_question_response(question, answer, prompt_template):
    """
    Get a response for presenting a question to the user.
    
    Args:
        question (str): The question to present
        answer (str): The correct answer (not shown to user)
        prompt_template (str): The prompt template to use
        
    Returns:
        str: The response text
    """
    prompt = prompt_template.format(question=question, answer=answer)
    
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a friendly study assistant."},
            {"role": "user", "content": prompt}
        ]
    )
    
    return response.choices[0].message.content

def evaluate_answer(question, user_answer, correct_answer, evaluation_prompt, answer_feedback_tool):
    """
    Evaluate if the user's answer is correct.
    
    Args:
        question (str): The original question
        user_answer (str): The user's answer
        correct_answer (str): The correct answer
        evaluation_prompt (str): The prompt template for evaluation
        answer_feedback_tool (dict): The tool definition for answer feedback
        
    Returns:
        dict: Feedback information including correctness and explanation
    """
    prompt = evaluation_prompt.format(
        question=question,
        user_answer=user_answer,
        answer=correct_answer
    )
    
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a fair and helpful evaluator."},
            {"role": "user", "content": prompt}
        ],
        tools=[answer_feedback_tool]
    )
    
    # Extract the tool call from the response
    if response.choices[0].message.tool_calls:
        tool_call = response.choices[0].message.tool_calls[0]
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

def handle_followup_question(question, correct_answer, followup, followup_prompt):
    """
    Handle a follow-up question from the user.
    
    Args:
        question (str): The original question
        correct_answer (str): The correct answer
        followup (str): The user's follow-up question
        followup_prompt (str): The prompt template for follow-up questions
        
    Returns:
        str: The response to the follow-up question
    """
    prompt = followup_prompt.format(
        question=question,
        answer=correct_answer,
        followup=followup
    )
    
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a helpful study partner."},
            {"role": "user", "content": prompt}
        ]
    )
    
    return response.choices[0].message.content 