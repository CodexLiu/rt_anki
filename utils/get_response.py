from openai import OpenAI
import os
import dotenv

dotenv.load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_response(prompt):
    """
    Get a response from OpenAI API based on the provided prompt.
    
    Args:
        prompt (str): The input prompt to send to the API
        
    Returns:
        The response from the OpenAI API
    """
    response = client.responses.create(
        model="gpt-4.1",
        input=prompt
    )
    
    return response


if __name__ == "__main__":
    sample_response = get_response("Tell me a three sentence bedtime story about a unicorn.")
    print(sample_response)