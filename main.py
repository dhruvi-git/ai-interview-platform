import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
from dotenv import load_dotenv

# Import our agents
from agents.interviewer import InterviewerAgent
from agents.evaluator import EvaluatorAgent
from agents.coach import CoachAgent

load_dotenv()

app = FastAPI(title="prep.ai Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Resolve Absolute Paths for Prompts ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTERVIEWER_PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "interviewer_prompt.txt")
EVALUATOR_PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "evaluator_prompt.json")
COACH_PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "coach_prompt.md")

# --- Initialize Agents ---
try:
    interviewer_agent = InterviewerAgent(INTERVIEWER_PROMPT_PATH)
    evaluator_agent = EvaluatorAgent(EVALUATOR_PROMPT_PATH)
    coach_agent = CoachAgent(COACH_PROMPT_PATH)
except Exception as e:
    print(f"Error initializing agents: {str(e)}")

# --- Data Models ---
class Message(BaseModel):
    role: str  # "interviewer" or "candidate"
    text: str

class StartSessionRequest(BaseModel):
    role: str
    focus: str
    background: Optional[str] = ""

class ChatRequest(BaseModel):
    role: str
    focus: str
    background: Optional[str] = ""
    messages: List[Message]

# --- Routes / Core Logic ---

@app.post("/api/start")
async def start_session(req: StartSessionRequest):
    """Initializes the session and returns the opening question tailored to the profile."""
    try:
        opening_question = interviewer_agent.get_opening_question(
            role=req.role,
            focus=req.focus,
            background=req.background
        )
        return {"text": opening_question}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def process_turn(req: ChatRequest):
    """Processes dynamic interview turns. If turn count >= 5, triggers evaluation and coaching agents."""
    try:
        candidate_turns = [m for m in req.messages if m.role == "candidate"]
        current_turn_count = len(candidate_turns)
        
        # Build conversational string history
        history_str = ""
        for m in req.messages:
            speaker = "Interviewer" if m.role == "interviewer" else "Candidate"
            history_str += f"{speaker}: {m.text}\n\n"

        # Check if conversation limit has completed
        if current_turn_count >= 5:
            # --- Trigger Agent 2: The Evaluator (Final Score Matrix) ---
            matrix_data = evaluator_agent.evaluate_final(
                role=req.role,
                focus=req.focus,
                history_str=history_str
            )

            # --- Trigger Agent 3: The Coach (Markdown Feedback Engine) ---
            feedback_markdown = coach_agent.generate_feedback(
                role=req.role,
                focus=req.focus,
                history_str=history_str,
                matrix_data=matrix_data
            )
            
            return {
                "finished": True,
                "matrix": matrix_data,
                "feedback_markdown": feedback_markdown
            }
            
        else:
            # --- Perform Turn-Level Evaluation for Adaptive Questioning ---
            turn_evaluation = evaluator_agent.evaluate_turn(
                role=req.role,
                focus=req.focus,
                history_str=history_str
            )
            
            turn_feedback_str = (
                f"Candidate Last Response Performance: {turn_evaluation.get('performance', 'average')}\n"
                f"Critique: {turn_evaluation.get('critique', '')}\n"
                f"Suggested Action: {turn_evaluation.get('suggested_action', 'maintain')}"
            )
            
            # --- Continue Turn Loop via Agent 1 (Interviewer) ---
            next_question = interviewer_agent.get_next_question(
                role=req.role,
                focus=req.focus,
                background=req.background,
                history_str=history_str,
                turn_evaluation=turn_feedback_str
            )
            
            return {
                "finished": False,
                "text": next_question
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)