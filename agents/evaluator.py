import os
import json
from groq import Groq

class EvaluatorAgent:
    """
    EvaluatorAgent manages evaluation logic.
    It performs lightweight turn-by-turn evaluation to help steer the Interviewer,
    and a final deep evaluation to grade the candidate on multiple dimensions, using the Groq API.
    """
    def __init__(self, prompt_path: str):
        self.prompt_path = prompt_path
        with open(prompt_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.turn_prompt_template = data["turn_evaluation_prompt"]
            self.final_prompt_template = data["final_evaluation_prompt"]

    def _clean_json_response(self, text: str) -> str:
        """Helper to strip markdown fence blocks if the model generates them."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        return text

    def evaluate_turn(self, role: str, focus: str, history_str: str) -> dict:
        """Evaluates the candidate's latest response and returns steering advice."""
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        system_instructions = self.turn_prompt_template.format(
            role=role,
            focus=focus,
            history_str=history_str
        )
        
        prompt = "Analyze the candidate's last response and output the evaluation JSON."
        
        try:
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.2,  # Low temperature for strict structured format
                response_format={"type": "json_object"}
            )
            cleaned = self._clean_json_response(response.choices[0].message.content)
            return json.loads(cleaned)
        except Exception as e:
            # Fallback if evaluation fails
            return {
                "performance": "average",
                "critique": f"Turn evaluation fallback triggered due to error: {str(e)}",
                "suggested_action": "maintain"
            }

    def evaluate_final(self, role: str, focus: str, history_str: str) -> dict:
        """Evaluates the entire interview transcript and outputs final rubric metrics."""
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        system_instructions = self.final_prompt_template.format(
            role=role,
            focus=focus,
            history_str=history_str
        )
        
        prompt = "Synthesize all details from the transcript to generate the final analytical rubric JSON."
        
        try:
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.2,  # Low temperature for grading consistency
                response_format={"type": "json_object"}
            )
            cleaned = self._clean_json_response(response.choices[0].message.content)
            return json.loads(cleaned)
        except Exception as e:
            # Fallback overall matrix
            return {
                "communication_score": 7,
                "technical_score": 6,
                "problem_solving_score": 7,
                "justification": f"Final evaluation fallback triggered. Error: {str(e)}"
            }
