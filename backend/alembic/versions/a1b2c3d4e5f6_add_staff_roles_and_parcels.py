"""add staff_roles and parcels

Revision ID: a1b2c3d4e5f6
Revises: 744511298da7
Create Date: 2026-10-03 14:41:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '744511298da7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'staff_roles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('society_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('title', sa.String(length=80), server_default='', nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['society_id'], ['societies.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'society_id', 'role'),
        sa.CheckConstraint("role IN ('Admin', 'Secretary', 'Treasurer', 'Guard')", name='check_staff_role')
    )
    op.create_index(op.f('ix_staff_roles_society_id'), 'staff_roles', ['society_id'], unique=False)
    op.create_index(op.f('ix_staff_roles_user_id'), 'staff_roles', ['user_id'], unique=False)

    op.create_table(
        'parcels',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('society_id', sa.String(length=36), nullable=False),
        sa.Column('unit_id', sa.String(length=36), nullable=False),
        sa.Column('courier', sa.String(length=80), nullable=False),
        sa.Column('recipient_name', sa.String(length=120), server_default='', nullable=False),
        sa.Column('tracking_code', sa.String(length=120), server_default='', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Arrived', nullable=False),
        sa.Column('otp', sa.String(length=6), nullable=False),
        sa.Column('photo_id', sa.String(length=36), nullable=True),
        sa.Column('logged_by', sa.String(length=36), nullable=False),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['society_id'], ['societies.id']),
        sa.ForeignKeyConstraint(['unit_id'], ['units.id']),
        sa.ForeignKeyConstraint(['logged_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('Arrived', 'Collected')", name='check_parcel_status')
    )
    op.create_index(op.f('ix_parcels_society_id'), 'parcels', ['society_id'], unique=False)
    op.create_index(op.f('ix_parcels_unit_id'), 'parcels', ['unit_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_parcels_unit_id'), table_name='parcels')
    op.drop_index(op.f('ix_parcels_society_id'), table_name='parcels')
    op.drop_table('parcels')
    op.drop_index(op.f('ix_staff_roles_user_id'), table_name='staff_roles')
    op.drop_index(op.f('ix_staff_roles_society_id'), table_name='staff_roles')
    op.drop_table('staff_roles')
