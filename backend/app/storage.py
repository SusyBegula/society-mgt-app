import io
from pathlib import Path
from typing import Protocol
import boto3
import httpx
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from app.config import settings


class Storage(Protocol):
    def put(self, key: str, content: bytes, content_type: str): ...
    def get(self, key: str) -> bytes: ...


class LocalStorage:
    def path(self, key):
        root = Path(settings().storage_path).resolve()
        target = (root / key).resolve()
        if not target.is_relative_to(root):
            raise ValueError("Invalid storage key")
        return target

    def put(self, key, content, content_type):
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def get(self, key):
        return self.path(key).read_bytes()


class S3Storage:
    def __init__(self):
        self.client = boto3.client("s3", endpoint_url=settings().s3_endpoint_url or None)

    def put(self, key, content, content_type):
        self.client.put_object(Bucket=settings().s3_bucket, Key=key, Body=content, ContentType=content_type)

    def get(self, key):
        return self.client.get_object(Bucket=settings().s3_bucket, Key=key)["Body"].read()


class SupabaseStorage:
    def __init__(self):
        cfg = settings()
        self.url = cfg.supabase_url.rstrip("/")
        self.key = cfg.supabase_service_key
        self.bucket = cfg.supabase_bucket
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
        }

    def _ensure_bucket(self, client: httpx.Client):
        res = client.get(f"{self.url}/storage/v1/bucket/{self.bucket}", headers=self.headers)
        if res.status_code == 404:
            client.post(
                f"{self.url}/storage/v1/bucket",
                headers=self.headers,
                json={"id": self.bucket, "name": self.bucket, "public": False},
            )

    def put(self, key: str, content: bytes, content_type: str):
        clean_key = key.lstrip("/")
        endpoint = f"{self.url}/storage/v1/object/{self.bucket}/{clean_key}"
        headers = {
            **self.headers,
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(endpoint, content=content, headers=headers)
            if resp.status_code == 404 and "Bucket not found" in resp.text:
                self._ensure_bucket(client)
                resp = client.post(endpoint, content=content, headers=headers)
            if resp.is_error:
                raise HTTPException(502, f"Failed to store file in Supabase: {resp.text}")

    def get(self, key: str) -> bytes:
        clean_key = key.lstrip("/")
        endpoint = f"{self.url}/storage/v1/object/authenticated/{self.bucket}/{clean_key}"
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(endpoint, headers=self.headers)
            if resp.status_code == 404:
                resp = client.get(f"{self.url}/storage/v1/object/public/{self.bucket}/{clean_key}")
            if resp.status_code == 404:
                raise HTTPException(404, "File unavailable.")
            if resp.is_error:
                raise HTTPException(502, f"Failed to retrieve file from Supabase: {resp.text}")
            return resp.content


def storage() -> Storage:
    backend = settings().storage_backend
    if backend == "supabase":
        return SupabaseStorage()
    elif backend == "s3":
        return S3Storage()
    return LocalStorage()


def validate_file(content: bytes, mime: str):
    if mime in ("image/jpeg", "image/png", "image/webp"):
        try:
            with Image.open(io.BytesIO(content)) as image:
                if image.width * image.height > 25000000:
                    raise ValueError()
                expected = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}[mime]
                if image.format != expected:
                    raise ValueError()
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            raise HTTPException(422, "Please choose a valid JPG, PNG or WebP image.")
    elif mime == "application/pdf" and content.startswith(b"%PDF-"):
        return
    else:
        raise HTTPException(422, "Supported formats: JPG, PNG, WebP and PDF.")
