# ======================================================
# 🔐 SIMPLE FRAUD ALERT VOICE AGENT – DEMO BANK
# 👩‍💻 Built by: Poojitha Reddy
# 🎯 Goal: Verify user + Read suspicious txn + Mark safe/fraud
# ======================================================

import logging
import json
import os
from typing import Literal, Optional
from dataclasses import dataclass, field

print("\n" + "🔐" * 50)
print("🚀 FRAUD ALERT AGENT - DEMO BANK EDITION")
print("👩‍💻 Tutorial by: Poojitha Reddy")
print("🔐" * 50 + "\n")

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    WorkerOptions,
    cli,
    function_tool,
    RunContext,
)

from livekit.plugins import murf, silero, google, deepgram, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")
load_dotenv(".env.local")

# ======================================================
# 📚 FRAUD CASE "DATABASE" (JSON FILE)
# ======================================================

FRAUD_DB_FILE = "fraud_cases.json"

DEFAULT_FRAUD_CASES = [
    {
        "caseId": "CASE-001",
        "userName": "John",
        "securityIdentifier": "12345",
        "maskedCard": "**** **** **** 4242",
        "transactionAmount": 2599.50,
        "currency": "INR",
        "merchantName": "ABC Industries",
        "location": "Hyderabad, India",
        "timestamp": "2025-11-20T18:45:00",
        "transactionCategory": "e-commerce",
        "transactionSource": "alibaba.com",
        "securityQuestion": "What is your favorite color?",
        "securityAnswer": "blue",
        "status": "pending_review",
        "outcomeNote": ""
    },
    {
        "caseId": "CASE-002",
        "userName": "Neha",
        "securityIdentifier": "88921",
        "maskedCard": "**** **** **** 1182",
        "transactionAmount": 1499.00,
        "currency": "INR",
        "merchantName": "Urban Style Hub",
        "location": "Bangalore, India",
        "timestamp": "2025-11-22T14:20:00",
        "transactionCategory": "retail",
        "transactionSource": "myntra.com",
        "securityQuestion": "What is your pet's name?",
        "securityAnswer": "tiger",
        "status": "pending_review",
        "outcomeNote": ""
    },
    {
        "caseId": "CASE-003",
        "userName": "Karthik",
        "securityIdentifier": "55231",
        "maskedCard": "**** **** **** 9023",
        "transactionAmount": 3299.75,
        "currency": "INR",
        "merchantName": "TechZone Electronics",
        "location": "Chennai, India",
        "timestamp": "2025-11-23T09:55:00",
        "transactionCategory": "electronics",
        "transactionSource": "amazon.in",
        "securityQuestion": "Which city were you born in?",
        "securityAnswer": "chennai",
        "status": "pending_review",
        "outcomeNote": ""
    },
    {
        "caseId": "CASE-004",
        "userName": "Priya",
        "securityIdentifier": "77452",
        "maskedCard": "**** **** **** 5519",
        "transactionAmount": 799.00,
        "currency": "INR",
        "merchantName": "QuickFoods Delivery",
        "location": "Mumbai, India",
        "timestamp": "2025-11-24T20:10:00",
        "transactionCategory": "food delivery",
        "transactionSource": "swiggy.com",
        "securityQuestion": "What is your favorite movie?",
        "securityAnswer": "dangal",
        "status": "pending_review",
        "outcomeNote": ""
    },
    {
        "caseId": "CASE-005",
        "userName": "Rohan",
        "securityIdentifier": "66214",
        "maskedCard": "**** **** **** 3344",
        "transactionAmount": 529.00,
        "currency": "INR",
        "merchantName": "Fitness World",
        "location": "Pune, India",
        "timestamp": "2025-11-25T07:40:00",
        "transactionCategory": "subscription",
        "transactionSource": "cult.fit",
        "securityQuestion": "What is your favorite sport?",
        "securityAnswer": "cricket",
        "status": "pending_review",
        "outcomeNote": ""
    }
]


def _db_path() -> str:
    return os.path.join(os.path.dirname(__file__), FRAUD_DB_FILE)


def load_fraud_cases_from_file() -> list[dict]:
    path = _db_path()
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_FRAUD_CASES, f, indent=4, ensure_ascii=False)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_fraud_cases_to_file(cases: list[dict]) -> None:
    path = _db_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cases, f, indent=4, ensure_ascii=False)


def update_case_in_file(case_id: str, status: str, note: str) -> Optional[dict]:
    cases = load_fraud_cases_from_file()
    updated_case = None
    for case in cases:
        if case.get("caseId") == case_id:
            case["status"] = status
            case["outcomeNote"] = note
            updated_case = case
            break
    if updated_case:
        save_fraud_cases_to_file(cases)
    return updated_case


# ======================================================
# 🧠 STATE MANAGEMENT
# ======================================================

@dataclass
class FraudState:
    fraud_cases: list
    current_case: Optional[dict] = None
    verification_attempts: int = 0
    verified: bool = False
    call_finished: bool = False


@dataclass
class Userdata:
    fraud_state: FraudState
    agent_session: Optional[AgentSession] = None


# ======================================================
# 🛠️ FRAUD TOOLS
# ======================================================

@function_tool
async def load_fraud_case(ctx: RunContext[Userdata], user_name: str) -> dict | str:
    state = ctx.userdata.fraud_state
    user_name_norm = user_name.strip().lower()
    cases = load_fraud_cases_from_file()
    state.fraud_cases = cases
    for case in cases:
        if case["userName"].lower() == user_name_norm and case["status"] == "pending_review":
            state.current_case = case
            state.verification_attempts = 0
            state.verified = False
            state.call_finished = False
            return {
                "caseId": case["caseId"],
                "userName": case["userName"],
                "maskedCard": case["maskedCard"],
                "merchantName": case["merchantName"],
                "transactionAmount": case["transactionAmount"],
                "currency": case["currency"],
                "location": case["location"],
                "timestamp": case["timestamp"],
                "transactionCategory": case["transactionCategory"],
                "transactionSource": case["transactionSource"],
                "securityQuestion": case["securityQuestion"],
            }
    return "No pending fraud case found for this user name in the demo database."


@function_tool
async def check_security_answer(ctx: RunContext[Userdata], answer: str) -> str:
    state = ctx.userdata.fraud_state
    case = state.current_case
    if not case:
        return "No active fraud case loaded."
    state.verification_attempts += 1
    if answer.strip().lower() == case["securityAnswer"].lower():
        state.verified = True
        state.verification_attempts = 0
        return "Verification_success"
    if state.verification_attempts >= 2:
        update_case_in_file(case["caseId"], "verification_failed", "Verification failed after 2 attempts.")
        state.call_finished = True
        return "Verification_failed_max_attempts"
    return "Verification_failed_try_again"


@function_tool
async def update_fraud_status(ctx: RunContext[Userdata], status: Literal["confirmed_safe", "confirmed_fraud", "verification_failed"], note: str) -> str:
    state = ctx.userdata.fraud_state
    case = state.current_case
    if not case:
        return "No active fraud case to update."
    updated = update_case_in_file(case["caseId"], status, note)
    if updated:
        state.current_case = updated
        state.call_finished = True
        return f"Case {updated['caseId']} updated to {status}."
    return "Failed to update fraud case in database."


# ======================================================
# 🧠 AGENT DEFINITION
# ======================================================

FRAUD_AGENT_INSTRUCTIONS = """
You are a calm, professional fraud detection representative for a fictional bank.
This is a DEMO with fake data.

Follow this call sequence:
1. Greet and explain suspicious activity.
2. Ask for first name.
3. Call load_fraud_case(user_name).
4. Ask the provided security question.
5. Call check_security_answer(answer).
6. If verified:
   - Read transaction details.
   - Ask if customer made the purchase.
   - If yes: call update_fraud_status("confirmed_safe", note).
   - If no: call update_fraud_status("confirmed_fraud", note).
7. If verification fails twice:
   - End call politely.
8. Close with a short confirmation.

Never ask for:
- full card number
- PIN
- password
- OTP
"""

class FraudAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=FRAUD_AGENT_INSTRUCTIONS,
            tools=[load_fraud_case, check_security_answer, update_fraud_status],
        )


# ======================================================
# 🎬 ENTRYPOINT
# ======================================================

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    userdata = Userdata(
        fraud_state=FraudState(
            fraud_cases=load_fraud_cases_from_file(),
        )
    )

    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=google.LLM(model="gemini-2.5-flash"),
        tts=murf.TTS(
            voice="en-US-matthew",
            style="Promo",
            text_pacing=True,
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        userdata=userdata,
    )

    userdata.agent_session = session

    await session.start(
        agent=FraudAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC()
        ),
    )

    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
