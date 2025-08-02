from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

# --- Configuration ---
# This is the URL of your Ollama instance running on another PC
OLLAMA_API_URL = "http://192.168.1.12:11434/api/generate"
OLLAMA_MODEL = "gemma3:latest" # Or whatever model you are using

# Initialize Flask App
app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing

def create_review_prompt(code_snippet):
    """Creates a detailed, specific prompt for the AI model."""
    prompt = f"""
    You are an expert code reviewer. Your task is to analyze the following Python code snippet.
    Provide a concise and clear review in Markdown format. Focus on the most critical issues.
    Your review should cover:
    1.  **Bugs & Errors:** Identify any potential bugs or logic errors.
    2.  **Style & Readability (PEP 8):** Comment on major style issues.
    3.  **Best Practices & Performance:** Suggest critical improvements.

    **Instructions:**
    - Be direct and to the point.
    - Do not ask any follow-up questions.
    - Only provide the code review.

    Here is the code to review:
    ```python
    {code_snippet}
    ```
    """
    return prompt

@app.route('/api/review-code', methods=['POST'])
def review_code():
    """API endpoint to receive code and return an AI-generated review."""
    data = request.get_json()
    code_to_review = data.get('code')

    if not code_to_review:
        return jsonify({"error": "No code provided"}), 400

    # Create the detailed prompt for the AI
    prompt = create_review_prompt(code_to_review)

    # Prepare the payload for the Ollama API
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False  # We want the full response at once
    }

    try:
        # Send the request to your Ollama instance
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=60) # 60-second timeout
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)

        # Extract the AI's response
        api_response_data = response.json()
        ai_review = api_response_data.get("response", "No response from model.")

        return jsonify({"review": ai_review})

    except requests.exceptions.RequestException as e:
        # Handle network errors (e.g., cannot connect to Ollama)
        print(f"Error connecting to Ollama: {e}")
        return jsonify({"error": f"Could not connect to the AI model at {OLLAMA_API_URL}. Please ensure it's running and accessible."}), 500
    except Exception as e:
        # Handle other potential errors
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An unexpected error occurred on the server."}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)