import json
import os
from typing import Any, Optional

from openai import OpenAI

PATCH_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "language": {"type": ["string", "null"]},
        "tone": {"type": ["string", "null"], "enum": ["formal", "friendly", "short", "detailed", "-", None]},
        "interests": {"type": ["array", "null", "string"], "items": {"type": "string"}},
        "budget_min": {"type": ["integer", "null", "string"]},
        "budget_max": {"type": ["integer", "null", "string"]},
        "location": {"type": ["string", "null"]},
        "lead_stage": {"type": "string", "enum": ["new", "qualified", "proposal", "won", "lost", "-"]},
        "lead_score_delta": {"type": "integer"},
        "objections": {"type": ["array", "null", "string"], "items": {"type": "string"}},
        "notes_append": {"type": ["string", "null"]},
    },
    "required": [
        "language",
        "tone",
        "interests",
        "budget_min",
        "budget_max",
        "location",
        "lead_stage",
        "lead_score_delta",
        "objections",
        "notes_append",
    ],
}

_client: Optional[OpenAI] = None


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _get_client() -> OpenAI:
    global _client
    if _client is not None:
        return _client
    key = _env("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    _client = OpenAI(api_key=key)
    return _client


def _best_output_text(resp: Any) -> str:
    text = getattr(resp, "output_text", None)
    if text:
        return str(text)
    try:
        if getattr(resp, "output", None):
            chunks = []
            for item in resp.output:
                content = getattr(item, "content", None) or []
                for part in content:
                    t = getattr(part, "text", None)
                    if t:
                        chunks.append(str(t))
            if chunks:
                return "\n".join(chunks)
    except Exception:
        pass
    return "{}"


def _extract_structured_output(resp: Any) -> dict:
    # New SDKs may provide parsed JSON directly.
    parsed = getattr(resp, "output_parsed", None)
    if isinstance(parsed, dict):
        return parsed
    raw = _best_output_text(resp)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _is_not_relevant(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        s = v.strip().lower()
        return s in {"", "-", "—", "na", "n/a", "not relevant", "unknown"}
    return False


def _to_int_or_none(v: Any) -> Optional[int]:
    if v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        s = v.strip()
        if s in {"", "-", "—"}:
            return None
        try:
            return int(s)
        except Exception:
            return None
    return None


def _clean_str_list(v: Any) -> list[str]:
    if isinstance(v, str):
        if _is_not_relevant(v):
            return []
        return [v.strip()]
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        if not isinstance(item, str):
            continue
        s = item.strip()
        if not s or s in {"-", "—"}:
            continue
        if s not in out:
            out.append(s)
    return out


def _normalize_patch(patch: dict) -> dict:
    """
    Keep only relevant, typed fields.
    "-" / null means "not relevant" and is ignored.
    """
    out: dict = {}

    for key in ("language", "tone", "location"):
        value = patch.get(key)
        if not _is_not_relevant(value):
            out[key] = str(value).strip()

    lead_stage = patch.get("lead_stage")
    if not _is_not_relevant(lead_stage):
        out["lead_stage"] = str(lead_stage).strip()

    interests = _clean_str_list(patch.get("interests"))
    if interests:
        out["interests"] = interests

    objections = _clean_str_list(patch.get("objections"))
    if objections:
        out["objections"] = objections

    budget_min = _to_int_or_none(patch.get("budget_min"))
    budget_max = _to_int_or_none(patch.get("budget_max"))
    if budget_min is not None:
        out["budget_min"] = budget_min
    if budget_max is not None:
        out["budget_max"] = budget_max

    notes = patch.get("notes_append")
    if not _is_not_relevant(notes):
        out["notes_append"] = str(notes).strip()

    score_delta = patch.get("lead_score_delta")
    if isinstance(score_delta, int):
        out["lead_score_delta"] = score_delta
    else:
        score_parsed = _to_int_or_none(score_delta)
        out["lead_score_delta"] = score_parsed if score_parsed is not None else 0

    return out


def extract_profile_patch(prev_profile: dict, conversation_snippet: dict) -> dict:
    model_primary = _env("OPENAI_PROFILE_EXTRACT_MODEL", "gpt-5-nano")
    model_fallback = _env("OPENAI_PROFILE_EXTRACT_FALLBACK_MODEL", "gpt-5-mini")

    system = (
        "You are a CRM profile extraction engine. Analyze the latest chat messages and "
        "extract every piece of customer intelligence into a structured JSON patch.\n\n"

        "## EXTRACTION RULES\n"
        "- Extract aggressively: if a fact is stated or strongly implied, capture it.\n"
        "- All required keys must always be present in the output.\n"
        "- If a field has no new information in this conversation turn, set it to '-' (strings), "
        "null (numbers), or [] (arrays).\n"
        "- For interests and objections: APPEND new items, do not repeat what's already in prev_profile.\n\n"

        "## FIELD GUIDELINES\n\n"

        "**language**: The language the customer is writing in. Examples: 'ru', 'en', 'de', 'es'.\n\n"

        "**tone**: Detect from writing style:\n"
        "  - 'formal' = polite, complete sentences, professional vocabulary\n"
        "  - 'friendly' = casual, uses emoji or slang, warm\n"
        "  - 'short' = terse, few words, minimal punctuation\n"
        "  - 'detailed' = asks many questions, writes long messages\n"
        "  - '-' if not enough text to determine\n\n"

        "**interests**: Anything the customer expresses liking, curiosity, or enthusiasm about. "
        "Be broad — hobbies, product categories, topics, preferences all count. "
        "Examples: 'I love anime' -> ['anime']. 'Do you have vegan options?' -> ['vegan food']. "
        "'I'm looking for a birthday gift' -> ['gifts', 'birthday'].\n\n"

        "**budget_min / budget_max**: Extract when the customer mentions a price range, budget, "
        "or spending limit. '100-200 dollars' -> budget_min=100, budget_max=200. "
        "'Under 50' -> budget_max=50. Set to '-' if not mentioned.\n\n"

        "**location**: City, country, or region. 'I'm in Moscow' -> 'Moscow'. "
        "'Ship to Berlin' -> 'Berlin'. Set to '-' if not mentioned.\n\n"

        "**lead_stage**: Transition rules:\n"
        "  - 'new' -> 'qualified': Customer asks specific questions about products/pricing/availability\n"
        "  - 'qualified' -> 'proposal': Customer compares options, asks 'what do you recommend', or discusses terms\n"
        "  - 'proposal' -> 'won': Customer says 'yes', 'I'll take it', 'let's proceed', 'send me an invoice'\n"
        "  - Any -> 'lost': Customer says 'not interested', 'too expensive', 'no thanks', 'maybe later'\n"
        "  - Stay at current stage if no transition signal. Use '-' only if truly ambiguous.\n\n"

        "**lead_score_delta**: Incremental score change for this turn (range -20 to +20):\n"
        "  - +3 to +5: Expressed interest, asked a question about products\n"
        "  - +8 to +10: Compared options, discussed specifics, shared personal details\n"
        "  - +15 to +20: Purchase intent ('I want to buy', 'send me an offer')\n"
        "  - -5 to -10: Expressed doubt or hesitation\n"
        "  - -15 to -20: Explicit rejection ('not interested', 'too expensive')\n"
        "  - 0: Neutral or off-topic conversation\n\n"

        "**objections**: A customer concern that blocks a sale. NOT the same as a question. "
        "Examples of objections: 'That's too expensive', 'I don't trust online stores', "
        "'Delivery takes too long'. NOT objections: 'How much does it cost?', 'Do you deliver to Berlin?'\n\n"

        "**notes_append**: Any other useful intelligence not captured above. "
        "Summarize in 1 short sentence. Set to '-' if nothing noteworthy.\n\n"

        "## EXAMPLES\n\n"
        "User says: 'Привет, я ищу подарок на день рождения, бюджет до 5000 рублей'\n"
        "-> language='ru', tone='friendly', interests=['gifts','birthday'], "
        "budget_max=5000, lead_stage='qualified', lead_score_delta=+5\n\n"

        "User says: 'Too expensive, I'll think about it'\n"
        "-> language='en', tone='short', objections=['price too high'], "
        "lead_stage='lost', lead_score_delta=-15\n\n"

        "User says: 'Sounds great, can you send me the details?'\n"
        "-> language='en', tone='friendly', lead_stage='proposal', lead_score_delta=+10\n\n"

        "User says: 'ok' (in response to a product description)\n"
        "-> tone='short', lead_score_delta=+2, everything else '-' or []\n"
    )
    user_payload = {
        "prev_profile": prev_profile,
        "conversation_snippet": conversation_snippet,
    }

    client = _get_client()
    for model in (model_primary, model_fallback):
        try:
            resp = client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "customer_profile_patch",
                        "schema": PATCH_SCHEMA,
                        "strict": True,
                    }
                },
            )
            patch_raw = _extract_structured_output(resp)
            normalized = _normalize_patch(patch_raw if isinstance(patch_raw, dict) else {})
            if "lead_score_delta" not in normalized:
                normalized["lead_score_delta"] = 0
            return normalized
        except Exception:
            continue
    return {"lead_score_delta": 0}
