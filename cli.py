import os
import json
from dotenv import load_dotenv

# Import our agents
from agents.interviewer import InterviewerAgent
from agents.evaluator import EvaluatorAgent
from agents.coach import CoachAgent

def main():
    load_dotenv()
    if not os.environ.get("GROQ_API_KEY"):
        print("Error: GROQ_API_KEY is not set in the environment or .env file.")
        return

    print("====================================================")
    print("Welcome to prep.ai (CLI Edition)")
    print("====================================================")
    
    role = input("Enter target role (e.g., Frontend Engineer Intern): ").strip()
    if not role:
        role = "Frontend Engineer Intern"
        
    focus = input("Enter focus area (behavioral / technical / case / mixed): ").strip()
    if not focus:
        focus = "mixed"
        
    background = input("Enter brief background or resume snippet (optional): ").strip()

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    INTERVIEWER_PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "interviewer_prompt.txt")
    EVALUATOR_PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "evaluator_prompt.json")
    COACH_PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "coach_prompt.md")

    print("\nInitializing agents...")
    try:
        interviewer = InterviewerAgent(INTERVIEWER_PROMPT_PATH)
        evaluator = EvaluatorAgent(EVALUATOR_PROMPT_PATH)
        coach = CoachAgent(COACH_PROMPT_PATH)
    except Exception as e:
        print(f"Error initializing agents: {e}")
        return

    # Start session
    print("\nStarting mock interview session...")
    try:
        opening_q = interviewer.get_opening_question(role, focus, background)
    except Exception as e:
        print(f"Error calling Groq API: {e}")
        return

    messages = [{"role": "interviewer", "text": opening_q}]
    print(f"\n[Interviewer]: {opening_q}")

    turn_count = 0
    max_turns = 5

    while turn_count < max_turns:
        candidate_ans = input("\n[Candidate]: ").strip()
        while not candidate_ans:
            candidate_ans = input("Please enter a response: ").strip()
            
        messages.append({"role": "candidate", "text": candidate_ans})
        turn_count += 1
        
        # Build conversational string history
        history_str = ""
        for m in messages:
            speaker = "Interviewer" if m["role"] == "interviewer" else "Candidate"
            history_str += f"{speaker}: {m['text']}\n\n"

        if turn_count >= max_turns:
            print("\nEvaluating and generating coaching report. Please wait...")
            try:
                matrix_data = evaluator.evaluate_final(role, focus, history_str)
                feedback = coach.generate_feedback(role, focus, history_str, matrix_data)
                
                print("\n====================================================")
                print("                INTERVIEW COMPLETE                  ")
                print("====================================================")
                print(f"Scores:")
                print(f"- Communication: {matrix_data.get('communication_score', 0)}/10")
                print(f"- Technical Depth: {matrix_data.get('technical_score', 0)}/10")
                print(f"- Problem Solving: {matrix_data.get('problem_solving_score', 0)}/10")
                print(f"Justification: {matrix_data.get('justification', '')}")
                print("\nFeedback Report:\n")
                print(feedback)
            except Exception as e:
                print(f"Error compiling feedback: {e}")
            break
        else:
            print("\nEvaluating response...")
            try:
                turn_eval = evaluator.evaluate_turn(role, focus, history_str)
                turn_feedback_str = (
                    f"Candidate Last Response Performance: {turn_eval.get('performance', 'average')}\n"
                    f"Critique: {turn_eval.get('critique', '')}\n"
                    f"Suggested Action: {turn_eval.get('suggested_action', 'maintain')}"
                )
                
                next_q = interviewer.get_next_question(role, focus, background, history_str, turn_feedback_str)
                messages.append({"role": "interviewer", "text": next_q})
                print(f"\n[Interviewer]: {next_q}")
            except Exception as e:
                print(f"Error during turn loop: {e}")
                break

if __name__ == "__main__":
    main()
