"""Cliente mínimo da Graph API da Meta (Instagram e Anúncios)."""

from __future__ import annotations

import json
from typing import Any

import requests

from ..config import ConfigMeta


class ErroMeta(Exception):
    def __init__(self, mensagem: str, codigo: int | None = None, subcodigo: int | None = None):
        super().__init__(mensagem)
        self.codigo = codigo
        self.subcodigo = subcodigo


class GraphAPI:
    def __init__(self, meta: ConfigMeta, sessao: requests.Session | None = None):
        self.token = meta.token
        self.base = f"https://graph.facebook.com/{meta.versao}"
        self.sessao = sessao or requests.Session()

    def _tratar(self, resp: requests.Response) -> dict[str, Any]:
        try:
            corpo = resp.json()
        except ValueError:
            corpo = {}
        if resp.status_code >= 400 or "error" in corpo:
            erro = corpo.get("error", {})
            mensagem = erro.get("error_user_msg") or erro.get("message") or resp.text[:300]
            raise ErroMeta(mensagem, erro.get("code"), erro.get("error_subcode"))
        return corpo

    def get(self, caminho: str, **params: Any) -> dict[str, Any]:
        params["access_token"] = self.token
        return self._tratar(self.sessao.get(f"{self.base}/{caminho}", params=params, timeout=60))

    def post(self, caminho: str, **dados: Any) -> dict[str, Any]:
        corpo = {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in dados.items() if v is not None}
        corpo["access_token"] = self.token
        return self._tratar(self.sessao.post(f"{self.base}/{caminho}", data=corpo, timeout=120))
