"""society_operations"""
from alembic import op
import sqlalchemy as sa

revision = 'e4ec22c2fe06'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('audit_events',
    sa.Column('actor_id', sa.String(length=36), nullable=False),
    sa.Column('action', sa.String(length=80), nullable=False),
    sa.Column('resource_id', sa.String(length=36), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_events_society_id'), 'audit_events', ['society_id'], unique=False)
    op.create_table('vendors',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('phone', sa.String(length=16), nullable=False),
    sa.Column('category', sa.String(length=80), nullable=False),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendors_society_id'), 'vendors', ['society_id'], unique=False)
    op.create_table('expenses',
    sa.Column('vendor_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=150), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('invoice_number', sa.String(length=100), nullable=False),
    sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('submitted_by', sa.String(length=36), nullable=False),
    sa.Column('approved_by', sa.String(length=36), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reference', sa.String(length=100), nullable=False),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('amount > 0'),
    sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('vendor_id', 'invoice_number')
    )
    op.create_index(op.f('ix_expenses_society_id'), 'expenses', ['society_id'], unique=False)
    op.create_table('push_deliveries',
    sa.Column('notification_id', sa.String(length=36), nullable=False),
    sa.Column('device_id', sa.String(length=36), nullable=False),
    sa.Column('token', sa.String(length=255), nullable=False),
    sa.Column('state', sa.String(length=20), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('ticket_id', sa.String(length=100), nullable=True),
    sa.Column('error', sa.String(length=100), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('notification_id', 'device_id')
    )
    op.create_index(op.f('ix_push_deliveries_next_attempt_at'), 'push_deliveries', ['next_attempt_at'], unique=False)
    op.create_index(op.f('ix_push_deliveries_notification_id'), 'push_deliveries', ['notification_id'], unique=False)
    op.create_table('billing_rules',
    sa.Column('label', sa.String(length=100), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('basis', sa.String(length=20), nullable=False),
    sa.Column('unit_id', sa.String(length=36), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("basis IN ('Flat', 'Area')"),
    sa.CheckConstraint('amount > 0'),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_billing_rules_society_id'), 'billing_rules', ['society_id'], unique=False)
    op.create_table('join_requests',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('note', sa.String(length=500), nullable=False),
    sa.Column('unit_id', sa.String(length=36), nullable=False),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'unit_id')
    )
    op.create_index(op.f('ix_join_requests_society_id'), 'join_requests', ['society_id'], unique=False)
    op.create_index(op.f('ix_join_requests_unit_id'), 'join_requests', ['unit_id'], unique=False)
    op.create_table('bill_adjustments',
    sa.Column('bill_id', sa.String(length=36), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('actor_id', sa.String(length=36), nullable=False),
    sa.Column('unit_id', sa.String(length=36), nullable=False),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('amount > 0'),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['bill_id'], ['bills.id'], ),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bill_adjustments_society_id'), 'bill_adjustments', ['society_id'], unique=False)
    op.create_index(op.f('ix_bill_adjustments_unit_id'), 'bill_adjustments', ['unit_id'], unique=False)
    op.create_table('bank_transactions',
    sa.Column('reference', sa.String(length=100), nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('payment_id', sa.String(length=36), nullable=True),
    sa.Column('expense_id', sa.String(length=36), nullable=True),
    sa.Column('society_id', sa.String(length=36), nullable=False),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('amount != 0'),
    sa.ForeignKeyConstraint(['expense_id'], ['expenses.id'], ),
    sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ),
    sa.ForeignKeyConstraint(['society_id'], ['societies.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('expense_id'),
    sa.UniqueConstraint('payment_id'),
    sa.UniqueConstraint('society_id', 'reference')
    )
    op.create_index(op.f('ix_bank_transactions_society_id'), 'bank_transactions', ['society_id'], unique=False)
    op.add_column('bills', sa.Column('billing_key', sa.String(length=150), nullable=True))
    op.create_unique_constraint('uq_bills_billing_key', 'bills', ['billing_key'])
    op.add_column('emergency_alerts', sa.Column('status', sa.String(length=20), nullable=False, server_default=sa.text("'Open'")))
    op.add_column('emergency_alerts', sa.Column('acknowledged_by', sa.String(length=36), nullable=True))
    op.add_column('emergency_alerts', sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('emergency_alerts', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('emergency_alerts', sa.Column('response_note', sa.String(length=1000), nullable=False, server_default=sa.text("''")))
    op.create_foreign_key('fk_emergency_responder', 'emergency_alerts', 'users', ['acknowledged_by'], ['id'])
    op.add_column('memberships', sa.Column('receives_visitors', sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column('memberships', sa.Column('moved_in_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('memberships', sa.Column('moved_out_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('notifications', sa.Column('push_state', sa.String(length=20), nullable=False, server_default=sa.text("'Skipped'")))
    op.add_column('payments', sa.Column('payer_name', sa.String(length=100), nullable=False, server_default=sa.text("''")))
    op.add_column('societies', sa.Column('settings', sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
    op.add_column('societies', sa.Column('join_code', sa.String(length=32), nullable=True))
    op.create_unique_constraint('uq_societies_join_code', 'societies', ['join_code'])
    op.add_column('units', sa.Column('area_sqft', sa.Integer(), nullable=False, server_default=sa.text("0")))

def downgrade():
    op.drop_column('units', 'area_sqft')
    op.drop_constraint('uq_societies_join_code', 'societies', type_='unique')
    op.drop_column('societies', 'join_code')
    op.drop_column('societies', 'settings')
    op.drop_column('payments', 'payer_name')
    op.drop_column('notifications', 'push_state')
    op.drop_column('memberships', 'moved_out_at')
    op.drop_column('memberships', 'moved_in_at')
    op.drop_column('memberships', 'receives_visitors')
    op.drop_constraint('fk_emergency_responder', 'emergency_alerts', type_='foreignkey')
    op.drop_column('emergency_alerts', 'response_note')
    op.drop_column('emergency_alerts', 'resolved_at')
    op.drop_column('emergency_alerts', 'acknowledged_at')
    op.drop_column('emergency_alerts', 'acknowledged_by')
    op.drop_column('emergency_alerts', 'status')
    op.drop_constraint('uq_bills_billing_key', 'bills', type_='unique')
    op.drop_column('bills', 'billing_key')
    op.drop_index(op.f('ix_bank_transactions_society_id'), table_name='bank_transactions')
    op.drop_table('bank_transactions')
    op.drop_index(op.f('ix_bill_adjustments_unit_id'), table_name='bill_adjustments')
    op.drop_index(op.f('ix_bill_adjustments_society_id'), table_name='bill_adjustments')
    op.drop_table('bill_adjustments')
    op.drop_index(op.f('ix_join_requests_unit_id'), table_name='join_requests')
    op.drop_index(op.f('ix_join_requests_society_id'), table_name='join_requests')
    op.drop_table('join_requests')
    op.drop_index(op.f('ix_billing_rules_society_id'), table_name='billing_rules')
    op.drop_table('billing_rules')
    op.drop_index(op.f('ix_push_deliveries_notification_id'), table_name='push_deliveries')
    op.drop_index(op.f('ix_push_deliveries_next_attempt_at'), table_name='push_deliveries')
    op.drop_table('push_deliveries')
    op.drop_index(op.f('ix_expenses_society_id'), table_name='expenses')
    op.drop_table('expenses')
    op.drop_index(op.f('ix_vendors_society_id'), table_name='vendors')
    op.drop_table('vendors')
    op.drop_index(op.f('ix_audit_events_society_id'), table_name='audit_events')
    op.drop_table('audit_events')
