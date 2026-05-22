import os
import json
from groq import Groq

class CoachAgent:
    """
    CoachAgent reviews the final metrics and the complete conversation transcript
    to produce highly tailored, constructive markdown-based feedback reports.
    """
    def __init__(self, prompt_path: str):
        self.prompt_path = prompt_path
        with open(prompt_path, "r", encoding="utf-8") as f:
            self.system_prompt_template = f.read()

    def generate_feedback(self, role: str, focus: str, history_str: str, matrix_data: dict) -> str:
        """Generates a structured career and technical blueprint report in Markdown."""
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        system_instructions = self.system_prompt_template.format(
            role=role,
            focus=focus,
            matrix_json=json.dumps(matrix_data, indent=2),
            history_str=history_str
        )
        
        prompt = "Synthesize strengths, performance gaps, and an action plan into a Markdown report."
        
        try:
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return f"### ⚠️ Coaching Generation Error\n\nUnable to generate coaching feedback due to an API error: {str(e)}"

