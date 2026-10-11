import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from google import genai

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

load_dotenv(ENV_FILE)


def get_model_name() -> str:
    return (
        os.getenv("GEMINI_MODEL")
        or "gemini-3.5-flash-lite"
    )


@lru_cache(maxsize=1)
def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured."
        )

    return genai.Client(api_key=api_key)