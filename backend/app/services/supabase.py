from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


class SupabaseConfigurationError(RuntimeError):
    """Raised when a Supabase operation is attempted without configuration."""


def _require_configuration(key: str) -> tuple[str, str]:
    if not settings.supabase_url:
        raise SupabaseConfigurationError("SUPABASE_URL must be configured")
    if not key:
        raise SupabaseConfigurationError("A Supabase API key must be configured")
    return settings.supabase_url, key


@lru_cache(maxsize=2)
def _build_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_supabase_client(*, use_service_role: bool = False) -> Client:
    """Return the centralized Supabase client for server-side operations."""
    key = settings.supabase_service_role_key if use_service_role else settings.supabase_anon_key
    url, configured_key = _require_configuration(key)
    return _build_client(url, configured_key)


def verify_access_token(access_token: str) -> dict:
    """Verify a Supabase access token and return its trusted user payload."""
    if not access_token:
        raise SupabaseConfigurationError("An access token is required")

    try:
        client = get_supabase_client()
    except SupabaseConfigurationError:
        raise

    try:
        response = client.auth.get_user(access_token)
    except Exception as error:
        raise SupabaseConfigurationError("Supabase access-token verification failed") from error

    if response.user is None:
        raise SupabaseConfigurationError("Supabase returned no authenticated user")

    return {
        "id": str(response.user.id),
        "email": response.user.email,
        "app_metadata": response.user.app_metadata or {},
    }
