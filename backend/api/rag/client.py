"""Local-only Ollama boundary; no credentials, tools, proxy forwarding, or redirects."""
import json
import math
import socket
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from django.conf import settings


class AIError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(path, payload, timeout=None):
    url = urlsplit(settings.OLLAMA_BASE_URL)
    if url.scheme != "http" or url.hostname not in {"localhost", "127.0.0.1", "::1"} or url.path not in {"", "/"} or url.query or url.fragment or url.username or url.password:
        raise AIError("Configure Ollama on this machine's loopback interface.")
    req = Request(settings.OLLAMA_BASE_URL.rstrip("/") + path, data=json.dumps(payload).encode() if payload is not None else None, headers={"Content-Type": "application/json"})
    try:
        with build_opener(ProxyHandler({}), NoRedirect()).open(req, timeout=timeout or settings.AI_TIMEOUT_SECONDS) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise AIError("The model response was too large. Try a smaller request.")
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except HTTPError as exc:
        if exc.code == 404:
            raise AIError("The configured Ollama model is missing. Install it and retry.") from exc
        raise AIError("Ollama rejected the request. Check the model and input limits.") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise AIError("The local model timed out. Retry or use a smaller model.") from exc
    except URLError as exc:
        raise AIError("Cannot reach local Ollama. Start Ollama and retry.") from exc
    except (ValueError, TypeError, OSError) as exc:
        raise AIError("Ollama returned an unreadable response.") from exc


def embed(texts):
    data = request("/api/embed", {"model": settings.OLLAMA_EMBED_MODEL, "input": texts, "truncate": False, "keep_alive": "10m"})
    vectors = data.get("embeddings")
    if not isinstance(vectors, list) or len(vectors) != len(texts):
        raise AIError("The embedding response was incomplete.")
    normalized = []
    dimension = None
    for vector in vectors:
        if not isinstance(vector, list) or not vector or len(vector) > 4096 or any(type(x) not in (float, int) or not math.isfinite(x) for x in vector):
            raise AIError("The embedding response was invalid.")
        dimension = dimension or len(vector)
        norm = math.sqrt(sum(x*x for x in vector))
        if len(vector) != dimension or norm == 0:
            raise AIError("The embedding dimensions changed. Re-index the documents.")
        normalized.append([x / norm for x in vector])
    return normalized


def chat(messages, schema, timeout=None):
    data = request("/api/chat", {
        "model": settings.OLLAMA_CHAT_MODEL, "messages": messages, "format": schema,
        "stream": False, "think": False, "keep_alive": "10m",
        "options": {"temperature": 0.1, "num_ctx": 8192, "num_predict": 2200},
    }, timeout=timeout)
    if data.get("done") is not True or data.get("done_reason") == "length":
        raise AIError("The model did not finish its answer. Retry with a narrower goal.")
    content = data.get("message", {}).get("content")
    if not isinstance(content, str):
        raise AIError("The model returned no usable answer.")
    return content
