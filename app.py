from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import black
import sqlparse
import subprocess
import os
import re

# --- Configuration ---
OLLAMA_API_URL = "http://192.168.1.12:11434/api/generate"
OLLAMA_MODEL = "gemma3:latest"

# Initialize Flask App
app = Flask(__name__)
CORS(app)

# --- Helper function to call the AI model ---
def call_ollama(prompt):
    """Sends a prompt to the Ollama API and returns the response."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=120) # Increased timeout
        response.raise_for_status()
        api_response_data = response.json()
        return api_response_data.get("response", "No response from model.")
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to Ollama: {e}")
        raise ConnectionError(f"Could not connect to the AI model at {OLLAMA_API_URL}.")

def clean_code_response(response_text, language=''):
    """Removes markdown fences and language identifiers from a code block response."""
    # Pattern to match ```language\n ... ``` or ```\n ... ```
    pattern = re.compile(r'^```(?:' + re.escape(language) + r')?\n([\s\S]*?)\n```$', re.MULTILINE)
    match = pattern.match(response_text.strip())
    if match:
        return match.group(1).strip()
    return response_text.strip().strip('`')


# --- Prompt Creation Functions ---

def create_review_prompt(code_snippet, language, persona):
    """Creates a prompt for a code review, tailored by a persona."""
    personas = {
        "Standard": "You are an expert code reviewer. Provide a balanced review focusing on correctness, style, and performance.",
        "Beginner": "You are a friendly, encouraging code tutor. Explain concepts simply and provide helpful examples. Assume the user is new to programming.",
        "Security": "You are a security audit specialist. Your sole focus is to identify potential security vulnerabilities, such as injection attacks, data exposure, or unsafe practices.",
        "Performance": "You are a performance optimization expert. Your sole focus is on identifying performance bottlenecks, inefficient algorithms, and memory usage issues."
    }
    prompt_intro = personas.get(persona, personas["Standard"])
    
    prompt = f"""
    {prompt_intro}
    Your task is to analyze the following {language} code snippet.
    Provide a concise and clear review in plain Markdown format.
    Do not ask any follow-up questions.
    Do not enclose your response in a code block (e.g., avoid ```markdown).

    Here is the code to review:
    ```{language}
    {code_snippet}
    ```
    """
    return prompt

def create_fix_code_prompt(code, language, review):
    """Creates a prompt for the 'Fix My Code' feature."""
    return f"""
    Based on the following code review, please rewrite the original code to implement the suggested fixes.
    **Instructions:**
    - Output ONLY the complete, corrected {language} code block.
    - Do not include any explanations, apologies, or introductory text.
    - Your entire response should be a single, valid code block.

    **Original Code:**
    ```{language}
    {code}
    ```

    **Code Review:**
    {review}
    """

def create_generate_tests_prompt(code, language):
    """Creates a prompt for the 'Generate Unit Tests' feature."""
    frameworks = {
        "python": "pytest",
        "javascript": "Jest"
    }
    framework = frameworks.get(language, "an appropriate testing framework")
    return f"""
    You are a testing expert. Your task is to write unit tests for the following {language} code using {framework}.
    **Instructions:**
    - Output ONLY the complete, valid test code.
    - Do not include any explanations, apologies, or introductory text.
    - Your entire response should be a single, valid code block.

    **Code to Test:**
    ```{language}
    {code}
    ```
    """

def create_follow_up_prompt(code, language, review, conversation):
    """Creates a prompt for a conversational follow-up."""
    history = ""
    for msg in conversation:
        role = "User" if msg['role'] == 'user' else "You"
        history += f"{role}: {msg['content']}\n"

    return f"""
    You are in a conversation about a code review. Continue the conversation naturally.
    
    **Original Code:**
    ```{language}
    {code}
    ```

    **Your Initial Review:**
    {review}

    **Conversation History:**
    {history}

    Your task is to respond to the last user message. Keep your answer concise and helpful.
    Do not enclose your response in a code block.
    You can also do normal converstations like greeetings, asking questions, etc.
    """


# --- API Endpoints ---

@app.route('/api/review-code', methods=['POST'])
def review_code():
    data = request.get_json()
    code_to_review = data.get('code')
    language = data.get('language', 'python').lower()
    persona = data.get('persona', 'Standard')
    if not code_to_review:
        return jsonify({"error": "No code provided"}), 400

    try:
        prompt = create_review_prompt(code_to_review, language, persona)
        ai_review = call_ollama(prompt)
        return jsonify({"review": ai_review})
    except ConnectionError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An unexpected error occurred on the server."}), 500

@app.route('/api/fix-code', methods=['POST'])
def fix_code():
    data = request.get_json()
    code, language, review = data.get('code'), data.get('language'), data.get('review')
    try:
        prompt = create_fix_code_prompt(code, language, review)
        fixed_code = call_ollama(prompt)
        cleaned_code = clean_code_response(fixed_code, language)
        return jsonify({"result": cleaned_code})
    except ConnectionError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route('/api/generate-tests', methods=['POST'])
def generate_tests():
    data = request.get_json()
    code, language = data.get('code'), data.get('language')
    try:
        prompt = create_generate_tests_prompt(code, language)
        test_code = call_ollama(prompt)
        cleaned_code = clean_code_response(test_code, language)
        return jsonify({"result": cleaned_code})
    except ConnectionError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

@app.route('/api/follow-up', methods=['POST'])
def follow_up():
    data = request.get_json()
    code, language, review, conversation = data.get('code'), data.get('language'), data.get('review'), data.get('conversation')
    try:
        prompt = create_follow_up_prompt(code, language, review, conversation)
        response = call_ollama(prompt)
        return jsonify({"response": response})
    except ConnectionError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500


@app.route('/api/format-code', methods=['POST'])
def format_code():
    data = request.get_json()
    code = data.get('code', '')
    language = data.get('language', 'python')

    try:
        if language == 'python':
            formatted_code = black.format_str(code, mode=black.FileMode(line_length=88))
        elif language == 'javascript':
            # This method remains the same
            with open('temp.js', 'w') as f:
                f.write(code)
            subprocess.run(['npx', 'prettier', '--write', 'temp.js'], check=True)
            with open('temp.js', 'r') as f:
                formatted_code = f.read()
            os.remove('temp.js')
        elif language == 'sql':
            formatted_code = sqlparse.format(code, reindent=True, keyword_case='upper')
        else:
            return jsonify({'error': f'Unsupported language: {language}'}), 400
        return jsonify({'formattedCode': formatted_code})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
