"""Refund requests and provider reconciliation."""
from alembic import op
import sqlalchemy as sa
revision = '9b170d42a918'
down_revision = 'fcedebb98a6f'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('refunds',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('society_id', sa.String(36), sa.ForeignKey('societies.id'), nullable=False),
        sa.Column('unit_id', sa.String(36), sa.ForeignKey('units.id'), nullable=False),
        sa.Column('payment_id', sa.String(36), sa.ForeignKey('payments.id'), nullable=False),
        sa.Column('requested_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(500), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('reviewed_by', sa.String(36), sa.ForeignKey('users.id')),
        sa.Column('reference', sa.String(100), unique=True),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('amount > 0'))
    for column in ('society_id', 'unit_id', 'payment_id'):
        op.create_index('ix_refunds_' + column, 'refunds', [column])

def downgrade():
    op.drop_table('refunds')
