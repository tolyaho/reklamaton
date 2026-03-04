# image_gen.py
import os
import uuid
import base64
from typing import Optional

from openai import OpenAI


class OpenAIImageAPI:
    """
    Wrapper for avatar image generation using OpenAI Images API.
    Keeps the old call shape used by `main.py` (`generate/check_generation/save_images`).
      pid = client.get_pipeline()
      req = client.generate(prompt, pid, ...)
      files = client.check_generation(req)
      client.save_images(files, out_path_prefix)

    Internally uses OpenAI Images API (gpt-image-*).
    """

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        *,
        model: Optional[str] = None,
        quality: Optional[str] = None,
        size: Optional[str] = None,
        output_format: Optional[str] = None,
        background: Optional[str] = None,
    ):
        key = api_key or os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY is required (env or constructor arg)")

        self.client = OpenAI(api_key=key)

        self.model = model or os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1-mini")
        self.quality = quality or os.getenv("OPENAI_IMAGE_QUALITY", "low")
        self.size = size or os.getenv("OPENAI_IMAGE_SIZE", "1024x1024")
        self.output_format = output_format or os.getenv("OPENAI_IMAGE_FORMAT", "png")
        self.background = background or os.getenv("OPENAI_IMAGE_BACKGROUND", "auto")

        self._jobs: dict[str, list[str]] = {}

    def get_pipeline(self):
        return "openai"

    def generate(
        self,
        prompt: str,
        pipeline_id=None,
        images: int = 1,
        width: int = 1024,
        height: int = 1024,
        style: str | None = None,
        negative_prompt: str | None = None,
    ):
        # If caller passes width/height, map to supported sizes where possible.
        size = self._pick_size(width, height) or self.size

        p = prompt
        if style:
            p += f"\n\nStyle: {style}"
        if negative_prompt:
            # OpenAI Images API doesn't have a dedicated negative_prompt parameter,
            # so we encode it as instruction text.
            p += f"\n\nAvoid: {negative_prompt}"

        resp = self.client.images.generate(
            model=self.model,
            prompt=p,
            n=max(1, min(int(images), 10)),
            size=size,
            quality=self.quality,
            output_format=self.output_format,
            background=self.background,
        )

        b64s: list[str] = []
        for im in (resp.data or []):
            b = getattr(im, "b64_json", None)
            if b:
                b64s.append(b)

        if not b64s:
            raise RuntimeError("No image data returned from OpenAI Images API")

        rid = str(uuid.uuid4())
        self._jobs[rid] = b64s
        return rid

    def check_generation(self, request_id: str, attempts: int = 10, delay: int = 5):
        # OpenAI returns the image payload immediately (base64) for gpt-image-* models. :contentReference[oaicite:1]{index=1}
        return self._jobs.get(request_id)

    def save_images(self, files, out_path_prefix: str):
        ext = {"png": "png", "jpeg": "jpg", "webp": "webp"}.get(self.output_format, "png")
        for i, b64 in enumerate(files, start=1):
            blob = base64.b64decode(b64)
            dst = f"{out_path_prefix}_{i}.{ext}"
            with open(dst, "wb") as f:
                f.write(blob)
        return True

    @staticmethod
    def _pick_size(w: int, h: int) -> Optional[str]:
        # Supported GPT image sizes include 1024x1024, 1024x1536, 1536x1024, auto. :contentReference[oaicite:2]{index=2}
        if (w, h) == (1024, 1024):
            return "1024x1024"
        if (w, h) == (1024, 1536):
            return "1024x1536"
        if (w, h) == (1536, 1024):
            return "1536x1024"
        if h > w:
            return "1024x1536"
        if w > h:
            return "1536x1024"
        return "1024x1024"


# Backward compatibility for older imports.
FusionBrainAPI = OpenAIImageAPI