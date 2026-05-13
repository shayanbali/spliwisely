import requests
from django.core.cache import cache

CACHE_TTL = 3600  # 1 hour
FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=USD'

# Fallback rates if API is unreachable (approximate, updated periodically)
FALLBACK_RATES = {
    'USD': 1.0, 'EUR': 0.92, 'GBP': 0.79, 'CAD': 1.36,
    'AUD': 1.53, 'JPY': 149.5, 'CHF': 0.90, 'CNY': 7.24, 'INR': 83.1,
}


def get_rates() -> dict:
    """
    Returns exchange rates relative to USD (1 USD = X currency).
    Result always includes USD: 1.0.
    Cached for 1 hour; falls back to static rates if Frankfurter is unreachable.
    """
    cached = cache.get('fx_rates_usd')
    if cached:
        return cached

    try:
        resp = requests.get(FRANKFURTER_URL, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        rates = {'USD': 1.0, **data['rates']}
    except Exception:
        rates = FALLBACK_RATES.copy()

    cache.set('fx_rates_usd', rates, CACHE_TTL)
    return rates


def convert(amount: float, from_currency: str, to_currency: str, rates: dict) -> float:
    """Convert amount from from_currency to to_currency using USD-base rates."""
    if from_currency == to_currency:
        return amount
    rate_from = rates.get(from_currency, 1.0)
    rate_to = rates.get(to_currency, 1.0)
    return amount * (rate_to / rate_from)
