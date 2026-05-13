import requests
from .models import PushToken

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def send_push(users, title: str, body: str, data: dict = None):
    tokens = PushToken.objects.filter(user__in=users).values_list('token', flat=True)
    if not tokens:
        return

    messages = [
        {
            'to': token,
            'title': title,
            'body': body,
            'data': data or {},
            'sound': 'default',
        }
        for token in tokens
    ]

    try:
        requests.post(EXPO_PUSH_URL, json=messages, timeout=5)
    except requests.RequestException:
        pass
