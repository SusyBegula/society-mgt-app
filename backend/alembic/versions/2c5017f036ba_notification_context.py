"""Bind new notifications to the originating property or staff context."""
from alembic import op
import sqlalchemy as sa

revision = "2c5017f036ba"
down_revision = "9b170d42a918"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("notifications", sa.Column("context_id", sa.String(36), nullable=True))
    op.create_index("ix_notifications_context_id", "notifications", ["context_id"])


def downgrade():
    op.drop_index("ix_notifications_context_id", table_name="notifications")
    op.drop_column("notifications", "context_id")
