from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from huntarr_api.config import settings
from huntarr_core.db.repo import HuntRepo
from huntarr_core.vault import decrypt_secret, encrypt_secret

LLM_PROVIDER_CONFIG_KEY = 'llm_providers_v1'
LLM_PROVIDER_VAULT_DOMAIN = 'llm-provider'
DEFAULT_LLM_PROVIDER_ID = 'default-openai-compatible'
_SUPPORTED_KEY_SOURCES = {'none', 'env', 'vault'}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _normalize_base_url(base_url: str) -> str:
    return base_url.strip().rstrip('/')


def _normalize_provider(raw: dict[str, Any]) -> dict[str, Any] | None:
    provider_id = str(raw.get('id') or '').strip()
    name = str(raw.get('name') or '').strip()
    base_url = _normalize_base_url(str(raw.get('base_url') or ''))
    model = str(raw.get('model') or '').strip()
    if not provider_id or not name or not base_url or not model:
        return None

    key_source = str(raw.get('key_source') or 'none').strip().lower()
    if key_source not in _SUPPORTED_KEY_SOURCES:
        key_source = 'none'

    now = _now_iso()
    created_at = str(raw.get('created_at') or now)
    updated_at = str(raw.get('updated_at') or created_at)
    return {
        'id': provider_id,
        'name': name,
        'base_url': base_url,
        'model': model,
        'key_source': key_source,
        'created_at': created_at,
        'updated_at': updated_at,
    }


def _normalize_state(raw_state: dict[str, Any]) -> dict[str, Any] | None:
    providers_raw = raw_state.get('providers')
    if not isinstance(providers_raw, list):
        return None

    providers: list[dict[str, Any]] = []
    for item in providers_raw:
        if not isinstance(item, dict):
            continue
        normalized = _normalize_provider(item)
        if normalized is not None:
            providers.append(normalized)

    active_provider_id: str | None
    if not providers:
        active_provider_id = None
    else:
        candidate = str(raw_state.get('active_provider_id') or '').strip()
        ids = {provider['id'] for provider in providers}
        active_provider_id = candidate if candidate in ids else providers[0]['id']

    return {
        'version': 1,
        'active_provider_id': active_provider_id,
        'providers': providers,
    }


async def _migrate_state(repository: HuntRepo) -> dict[str, Any]:
    legacy_config = await repository.get_config('default')
    legacy_value = legacy_config.get('value') if legacy_config else {}
    if not isinstance(legacy_value, dict):
        legacy_value = {}

    now = _now_iso()
    provider = {
        'id': DEFAULT_LLM_PROVIDER_ID,
        'name': 'Default OpenAI-compatible',
        'base_url': _normalize_base_url(str(legacy_value.get('openai_base_url') or settings.openai_base_url)),
        'model': str(legacy_value.get('openai_model') or settings.openai_model).strip() or settings.openai_model,
        'key_source': 'env' if settings.openai_api_key else 'none',
        'created_at': now,
        'updated_at': now,
    }
    state = {
        'version': 1,
        'active_provider_id': provider['id'],
        'providers': [provider],
    }
    await repository.set_config(LLM_PROVIDER_CONFIG_KEY, state)
    return state


async def save_provider_state(repository: HuntRepo, state: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_state(state)
    if normalized is None:
        raise ValueError('Invalid LLM provider state')
    await repository.set_config(LLM_PROVIDER_CONFIG_KEY, normalized)
    return normalized


async def ensure_provider_state(repository: HuntRepo) -> dict[str, Any]:
    cfg = await repository.get_config(LLM_PROVIDER_CONFIG_KEY)
    if cfg and isinstance(cfg.get('value'), dict):
        normalized = _normalize_state(cfg['value'])
        if normalized is not None:
            if normalized != cfg['value']:
                await repository.set_config(LLM_PROVIDER_CONFIG_KEY, normalized)
            return normalized
    return await _migrate_state(repository)


def _find_provider(state: dict[str, Any], provider_id: str) -> dict[str, Any] | None:
    providers = state.get('providers') or []
    for provider in providers:
        if provider.get('id') == provider_id:
            return provider
    return None


async def _store_provider_key(
    repository: HuntRepo,
    provider_id: str,
    provider_name: str,
    api_key: str,
) -> None:
    salt, nonce, ciphertext = encrypt_secret(
        settings.vault_master_passphrase,
        {'password': api_key},
    )
    await repository.insert_credential(
        domain=LLM_PROVIDER_VAULT_DOMAIN,
        username=provider_id,
        salt=salt,
        nonce=nonce,
        ciphertext=ciphertext,
        metadata={
            'kind': 'llm_api_key',
            'provider_name': provider_name,
        },
    )


async def _delete_provider_key(repository: HuntRepo, provider_id: str) -> None:
    await repository.delete_credential(LLM_PROVIDER_VAULT_DOMAIN, provider_id)


def _fallback_key_source(provider: dict[str, Any]) -> str:
    if provider.get('id') == DEFAULT_LLM_PROVIDER_ID and settings.openai_api_key:
        return 'env'
    return 'none'


async def resolve_provider_api_key(
    repository: HuntRepo,
    provider: dict[str, Any],
) -> tuple[str, str]:
    cred = await repository.get_credential(LLM_PROVIDER_VAULT_DOMAIN, provider['id'])
    if cred:
        try:
            decrypted = decrypt_secret(
                settings.vault_master_passphrase,
                cred['salt'],
                cred['nonce'],
                cred['ciphertext'],
            )
            key = str(decrypted.get('password') or '').strip()
            if key:
                return key, 'vault'
        except Exception:
            pass

    if provider.get('key_source') == 'env' and settings.openai_api_key:
        return settings.openai_api_key, 'env'
    return '', 'none'


async def build_provider_summary(
    repository: HuntRepo,
    provider: dict[str, Any],
    active_provider_id: str | None,
) -> dict[str, Any]:
    api_key, effective_key_source = await resolve_provider_api_key(repository, provider)
    return {
        'id': provider['id'],
        'name': provider['name'],
        'base_url': provider['base_url'],
        'model': provider['model'],
        'has_api_key': bool(api_key),
        'key_source': effective_key_source,
        'is_active': provider['id'] == active_provider_id,
        'updated_at': provider['updated_at'],
    }


async def list_provider_summaries(repository: HuntRepo) -> dict[str, Any]:
    state = await ensure_provider_state(repository)
    active_provider_id = state.get('active_provider_id')
    summaries = []
    for provider in state.get('providers') or []:
        summaries.append(await build_provider_summary(repository, provider, active_provider_id))
    return {
        'active_provider_id': active_provider_id,
        'items': summaries,
    }


async def get_provider(repository: HuntRepo, provider_id: str) -> dict[str, Any] | None:
    state = await ensure_provider_state(repository)
    return _find_provider(state, provider_id)


async def create_provider(
    repository: HuntRepo,
    *,
    name: str,
    base_url: str,
    model: str,
    api_key: str | None = None,
) -> dict[str, Any]:
    clean_name = name.strip()
    clean_base_url = _normalize_base_url(base_url)
    clean_model = model.strip()
    if not clean_name or not clean_base_url or not clean_model:
        raise ValueError('name, base_url, and model are required')

    state = await ensure_provider_state(repository)
    now = _now_iso()
    provider_id = str(uuid4())
    provider = {
        'id': provider_id,
        'name': clean_name,
        'base_url': clean_base_url,
        'model': clean_model,
        'key_source': 'none',
        'created_at': now,
        'updated_at': now,
    }
    key = (api_key or '').strip()
    if key:
        await _store_provider_key(repository, provider_id, clean_name, key)
        provider['key_source'] = 'vault'

    providers = state.get('providers') or []
    providers.append(provider)
    state['providers'] = providers
    if not state.get('active_provider_id'):
        state['active_provider_id'] = provider_id
    state = await save_provider_state(repository, state)
    return await build_provider_summary(repository, provider, state.get('active_provider_id'))


async def update_provider(
    repository: HuntRepo,
    provider_id: str,
    *,
    name: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    clear_api_key: bool = False,
) -> dict[str, Any]:
    state = await ensure_provider_state(repository)
    provider = _find_provider(state, provider_id)
    if provider is None:
        raise KeyError('Provider not found')

    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError('name cannot be empty')
        provider['name'] = clean_name
    if base_url is not None:
        clean_base_url = _normalize_base_url(base_url)
        if not clean_base_url:
            raise ValueError('base_url cannot be empty')
        provider['base_url'] = clean_base_url
    if model is not None:
        clean_model = model.strip()
        if not clean_model:
            raise ValueError('model cannot be empty')
        provider['model'] = clean_model

    if api_key is not None:
        clean_api_key = api_key.strip()
        if clean_api_key:
            await _store_provider_key(repository, provider_id, provider['name'], clean_api_key)
            provider['key_source'] = 'vault'
        else:
            await _delete_provider_key(repository, provider_id)
            provider['key_source'] = _fallback_key_source(provider)
    elif clear_api_key:
        await _delete_provider_key(repository, provider_id)
        provider['key_source'] = _fallback_key_source(provider)

    provider['updated_at'] = _now_iso()
    state = await save_provider_state(repository, state)
    return await build_provider_summary(repository, provider, state.get('active_provider_id'))


async def activate_provider(repository: HuntRepo, provider_id: str) -> dict[str, Any]:
    state = await ensure_provider_state(repository)
    provider = _find_provider(state, provider_id)
    if provider is None:
        raise KeyError('Provider not found')
    state['active_provider_id'] = provider_id
    state = await save_provider_state(repository, state)
    return await build_provider_summary(repository, provider, state.get('active_provider_id'))


async def delete_provider(repository: HuntRepo, provider_id: str) -> dict[str, Any]:
    state = await ensure_provider_state(repository)
    providers = state.get('providers') or []
    next_providers = [provider for provider in providers if provider.get('id') != provider_id]
    if len(next_providers) == len(providers):
        raise KeyError('Provider not found')

    await _delete_provider_key(repository, provider_id)
    state['providers'] = next_providers
    if state.get('active_provider_id') == provider_id:
        state['active_provider_id'] = next_providers[0]['id'] if next_providers else None
    state = await save_provider_state(repository, state)
    return {
        'success': True,
        'active_provider_id': state.get('active_provider_id'),
    }


async def resolve_active_runtime_config(repository: HuntRepo) -> dict[str, Any] | None:
    state = await ensure_provider_state(repository)
    providers = state.get('providers') or []
    if not providers:
        return None

    active_provider_id = state.get('active_provider_id')
    provider = _find_provider(state, str(active_provider_id)) if active_provider_id else None
    if provider is None:
        provider = providers[0]

    api_key, key_source = await resolve_provider_api_key(repository, provider)
    return {
        'provider_id': provider['id'],
        'name': provider['name'],
        'base_url': provider['base_url'],
        'model': provider['model'],
        'api_key': api_key,
        'key_source': key_source,
    }

