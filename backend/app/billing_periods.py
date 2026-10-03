from datetime import datetime


def period_key(period: str) -> str:
    """Match legacy English month labels with the scheduled YYYY-MM cycle."""
    value = " ".join(period.strip().split())
    for pattern in ("%Y-%m", "%B %Y", "%b %Y", "%m/%Y", "%B-%Y", "%b-%Y"):
        try:
            return datetime.strptime(value, pattern).strftime("%Y-%m")
        except ValueError:
            continue
    return value.casefold()
