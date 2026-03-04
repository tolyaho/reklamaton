import json
import os
from typing import Optional

from openai import OpenAI

from models import Business, Campaign, Customer, CustomerProfile

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


def _profile_list(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return [str(x) for x in parsed] if isinstance(parsed, list) else []
    except Exception:
        return []


def _channel_limit(channel: str) -> int:
    limits = {"sms": 160, "telegram": 400, "whatsapp": 400}
    return limits.get(channel, 500)


def _channel_format_instructions(channel: str) -> str:
    instructions = {
        "sms": (
            "SMS format: max 160 characters. Be extremely concise. "
            "No markdown. End with a short CTA (reply YES or call +X)."
        ),
        "telegram": (
            "Telegram format: max 400 characters. You may use light formatting "
            "(bold with *, line breaks). Include a clear CTA (reply, tap link, etc.)."
        ),
        "whatsapp": (
            "WhatsApp format: max 400 characters. Conversational tone. "
            "You may use *bold* and line breaks. End with a question or CTA."
        ),
        "email": (
            "Email body format: max 500 characters. Professional structure: "
            "greeting, value proposition, CTA. No subject line needed."
        ),
    }
    return instructions.get(channel, (
        "Web/general format: max 500 characters. Clear and engaging. "
        "End with a specific CTA (choose option A/B, leave phone, book a call)."
    ))


def _build_ad_prompt(
    business: Business,
    campaign: Campaign,
    customer: Customer,
    profile: CustomerProfile,
) -> str:
    interests = _profile_list(profile.interests_json)
    objections = _profile_list(profile.objections_json)
    channel = campaign.channel or "web"
    lang = (profile.language or "ru").lower()

    language_instruction = "Write in Russian." if lang.startswith("ru") else f"Write in {'English' if lang.startswith('en') else lang}."

    try:
        products = json.loads(business.products_json) if business.products_json else "not provided"
    except Exception:
        products = "not provided"

    return f"""
You are a marketing copywriter for {business.name}.
Generate a single personalized outbound message for a sales campaign.

## CAMPAIGN
- Offer: {campaign.offer_text}
- Channel: {channel}

## CUSTOMER
- Name: {customer.name or "valued customer"}
- Language: {lang}
- Tone preference: {profile.tone or "friendly"}
- Interests: {interests if interests else "unknown"}
- Budget: {profile.budget_min or "?"} – {profile.budget_max or "?"}
- Location: {profile.location or "unknown"}
- Lead stage: {profile.lead_stage} (score: {profile.lead_score})
- Known objections: {objections if objections else "none"}

## PRODUCT DATA
{products}

## RULES
1. {language_instruction}
2. Personalize: use the customer's name, reference their interests/preferences where relevant.
3. If the customer has objections, address the most critical one briefly and positively.
4. Adapt tone to match the customer's preference (formal → polite/professional, friendly → warm/casual, short → ultra-concise).
5. Do NOT make claims or promises not supported by the product data above.
6. Do NOT include hashtags, excessive emoji, or clickbait.
7. {_channel_format_instructions(channel)}

## OUTPUT
Return ONLY the message text. No quotes, no labels, no explanation.
""".strip()


def generate_ad_message(
    business: Business,
    campaign: Campaign,
    customer: Customer,
    profile: CustomerProfile,
) -> str:
    if not customer.marketing_opt_in:
        raise ValueError("Customer has not opted in for marketing")

    prompt = _build_ad_prompt(business, campaign, customer, profile)
    model = _env("OPENAI_AD_GEN_MODEL", "gpt-5-nano")
    channel = campaign.channel or "web"
    limit = _channel_limit(channel)

    client = _get_client()
    try:
        resp = client.responses.create(
            model=model,
            input=[
                {"role": "user", "content": prompt},
            ],
        )
        text = getattr(resp, "output_text", None) or ""
        if not text:
            try:
                for item in resp.output:
                    for part in getattr(item, "content", []):
                        t = getattr(part, "text", None)
                        if t:
                            text = str(t)
                            break
                    if text:
                        break
            except Exception:
                pass
    except Exception:
        return _fallback_message(business, campaign, customer, profile)

    text = text.strip().strip('"').strip("'").strip()

    if not text:
        return _fallback_message(business, campaign, customer, profile)

    if len(text) > limit:
        cut = text[:limit - 1]
        last_space = cut.rfind(" ")
        if last_space > limit // 2:
            text = cut[:last_space] + "…"
        else:
            text = cut + "…"

    return text


def _fallback_message(
    business: Business,
    campaign: Campaign,
    customer: Customer,
    profile: CustomerProfile,
) -> str:
    """Simple template fallback if LLM is unavailable."""
    lang = (profile.language or "ru").lower()
    name = customer.name or ("клиент" if lang.startswith("ru") else "customer")
    tone = (profile.tone or "friendly").lower()

    if lang.startswith("en"):
        greeting = "Hello" if tone == "formal" else "Hi"
        body = f"{greeting}, {name}! {business.name} has a new offer for you: {campaign.offer_text}. Reply to learn more!"
    else:
        greeting = "Здравствуйте" if tone == "formal" else "Привет"
        body = f"{greeting}, {name}! {business.name} подготовил(а) предложение: {campaign.offer_text}. Ответьте, чтобы узнать больше!"

    limit = _channel_limit(campaign.channel or "web")
    if len(body) > limit:
        cut = body[:limit - 1]
        last_space = cut.rfind(" ")
        if last_space > limit // 2:
            body = cut[:last_space] + "…"
        else:
            body = cut + "…"

    return body
