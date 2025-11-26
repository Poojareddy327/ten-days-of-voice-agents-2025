# ======================================================
# 🎧 SIMPLE SDR VOICE AGENT – RAZORPAY EDITION
# 👩‍💻 Built by: Poojitha Reddy
# 🎯 Goal: FAQ + Lead Capture + End-of-call Summary
# ======================================================

import logging
import json
import os
import asyncio
from typing import Annotated, Literal, Optional
from dataclasses import dataclass, asdict, field   # ✅ field added here

print("\n" + "🎧" * 50)
print("🚀 SDR AGENT - RAZORPAY (INDIA) EDITION")
print("👩‍💻 Tutorial by: Poojitha Reddy")
print("🎧" * 50 + "\n")

from dotenv import load_dotenv
from pydantic import Field
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

# 🔌 PLUGINS
from livekit.plugins import murf, silero, google, deepgram, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")
load_dotenv(".env.local")

# ======================================================
# 📚 COMPANY INFO + FAQ (RAZORPAY INDIA)
# ======================================================

FAQ_FILE = "razorpay_faq.json"
LEADS_FILE = "razorpay_leads.json"

COMPANY_PROFILE = {
    "name": "Razorpay",
    "tagline": "Modern payments and banking for Indian businesses.",
    "what_we_do": "Razorpay is a payments platform that helps businesses in India accept, process, and disburse payments.",
    "who_it_is_for": "Startups, SaaS companies, e-commerce brands, D2C, freelancers, NGOs, and enterprises.",
    "pricing_basic": "No setup or maintenance fee. Typical charge around 2% per domestic transaction.",
    "free_tier_info": "No separate free tier, but sandbox testing is free.",
}

DEFAULT_FAQ = [
    {
        "id": "what_is_razorpay",
        "question": "What does Razorpay do?",
        "answer": "Razorpay allows businesses to accept online payments via UPI, cards, netbanking and wallets.",
    },
    {
        "id": "pricing_basic",
        "question": "How does Razorpay pricing work?",
        "answer": "No setup fee; per-transaction pricing around 2% for domestic payments on standard plan.",
    },
    {
        "id": "free_tier",
        "question": "Do you have a free tier?",
        "answer": "Sandbox testing is free; no setup charges for standard plan.",
    },
]

def load_faq():
    try:
        path = os.path.join(os.path.dirname(__file__), FAQ_FILE)
        if not os.path.exists(path):
            print(f"⚠️ {FAQ_FILE} not found. Creating default Razorpay FAQ...")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_FAQ, f, indent=4, ensure_ascii=False)
            print("✅ Razorpay FAQ file created successfully.")
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def append_lead_to_file(lead_dict: dict):
    try:
        path = os.path.join(os.path.dirname(__file__), LEADS_FILE)
        leads = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                try:
                    leads = json.load(f)
                except:
                    leads = []
        leads.append(lead_dict)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(leads, f, indent=4, ensure_ascii=False)
        print("✅ Lead saved to JSON file.")
    except:
        pass

FAQ_DATA = load_faq()

# ======================================================
# 🧠 STATE MANAGEMENT
# ======================================================

@dataclass
class LeadInfo:
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    use_case: Optional[str] = None
    team_size: Optional[str] = None
    timeline: Optional[str] = None

@dataclass
class SDRState:
    faq_data: list
    lead: LeadInfo = field(default_factory=LeadInfo)   # ✅ FIX APPLIED
    conversation_ended: bool = False

@dataclass
class Userdata:
    sdr_state: SDRState
    agent_session: Optional[AgentSession] = None

# ======================================================
# 🔍 SIMPLE FAQ SEARCH
# ======================================================

def simple_faq_search(faq_list, query: str) -> dict | None:
    q = query.lower().strip()
    best = None
    score = 0
    for item in faq_list:
        text = (item["question"] + item["answer"]).lower()
        s = sum(1 for word in q.split() if word in text)
        if s > score:
            score = s
            best = item
    return best if score > 0 else None

# ======================================================
# 🛠️ SDR TOOLS
# ======================================================

@function_tool
async def search_faq(ctx: RunContext[Userdata], query: str) -> str:
    faq = simple_faq_search(ctx.userdata.sdr_state.faq_data, query)
    if not faq:
        return "No matching FAQ found. Offer to connect to sales."
    return faq["answer"]

@function_tool
async def update_lead_field(ctx: RunContext[Userdata], field: str, value: str) -> str:
    setattr(ctx.userdata.sdr_state.lead, field, value.strip())
    append_lead_to_file(asdict(ctx.userdata.sdr_state.lead))
    return f"Lead field '{field}' updated."

@function_tool
async def finalize_lead(ctx: RunContext[Userdata]) -> str:
    ctx.userdata.sdr_state.conversation_ended = True
    append_lead_to_file(asdict(ctx.userdata.sdr_state.lead))
    return "Lead summary ready."

# ======================================================
# 🧠 AGENT DEFINITION (Single Voice)
# ======================================================

class SDRAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=f"""
You are a friendly SDR from Razorpay.
Greet, ask what they are building, answer FAQs using search_faq,
collect lead info gradually, then finalize when user says done.
""",
            tools=[search_faq, update_lead_field, finalize_lead],
        )

# ======================================================
# 🎬 ENTRYPOINT
# ======================================================

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

async def entrypoint(ctx: JobContext):
    userdata = Userdata(sdr_state=SDRState(faq_data=FAQ_DATA))
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
        agent=SDRAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC()
        ),
    )
    await ctx.connect()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
