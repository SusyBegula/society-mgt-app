from app.models import AuditEvent


def audit(db, actor, action, resource_id, **details):
    """Append an event in the same transaction as the change. Never store secrets."""
    db.add(AuditEvent(society_id=actor.society_id, actor_id=actor.user_id,
                      action=action, resource_id=resource_id, details=details))
