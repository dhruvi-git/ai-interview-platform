import os
from groq import Groq

class InterviewerAgent:
    """
    InterviewerAgent represents the hiring manager agent.
    It welcomes the candidate, starts the session, and generates
    adaptive follow-up questions guided by real-time turn evaluations,
    using the Groq API.
    """
    def __init__(self, prompt_path: str):
        self.prompt_path = prompt_path
        with open(prompt_path, "r", encoding="utf-8") as f:
            self.system_prompt_template = f.read()

    def get_opening_question(self, role: str, focus: str, background: str) -> str:
        """Initializes the session and returns the opening question tailored to the profile."""
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        # When opening, we don't have turn evaluation feedback yet
        system_instructions = self.system_prompt_template.format(
            role=role,
            focus=focus,
            background=background or "None provided",
            turn_evaluation="First turn. No feedback yet."
        )
        
        prompt = "Initialize the interview. Welcome the candidate, state the focus of this drill, and ask your very first targeted question."
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()

    def get_next_question(self, role: str, focus: str, background: str, history_str: str, turn_evaluation: str) -> str:
        """Generates the next question in the loop based on the conversation history and turn evaluation feedback."""
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        system_instructions = self.system_prompt_template.format(
            role=role,
            focus=focus,
            background=background or "None provided",
            turn_evaluation=turn_evaluation
        )
        
        prompt = f"Review the complete log of the conversation so far, incorporate the turn evaluation feedback, and output your dynamic next conversational response question:\n\n{history_str}"
        
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
