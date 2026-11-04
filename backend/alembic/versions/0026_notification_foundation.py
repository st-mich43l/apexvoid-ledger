"""add notification inbox and delivery records

Revision ID: 0026
Revises: 0025
"""
from alembic import op
import sqlalchemy as sa

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table("push_subscriptions",
    sa.Column("id", sa.String(36), primary_key=True),
    sa.Column("user_id", sa.String(), sa.ForeignKey("User.id", ondelete="CASCADE"), nullable=False),
    sa.Column("endpoint_hash", sa.String(64), nullable=False, unique=True),
    sa.Column("material_ciphertext", sa.String(8192), nullable=False),
    sa.Column("device_name", sa.String(120), nullable=False),
    sa.Column("enabled", sa.Boolean(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False))
  op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
  op.create_table("notifications",
    sa.Column("id", sa.String(36), primary_key=True),
    sa.Column("user_id", sa.String(), sa.ForeignKey("User.id", ondelete="CASCADE"), nullable=False),
    sa.Column("event_type", sa.String(64), nullable=False),
    sa.Column("event_key", sa.String(255), nullable=False),
    sa.Column("title", sa.String(160), nullable=False),
    sa.Column("body", sa.String(500), nullable=False),
    sa.Column("destination", sa.String(512), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("read_at", sa.DateTime(timezone=True)),
    sa.UniqueConstraint("user_id", "event_type", "event_key", name="uq_notification_user_event"))
  op.create_index("ix_notification_user_created", "notifications", ["user_id", "created_at"])
  op.create_table("notification_preferences",
    sa.Column("user_id", sa.String(), sa.ForeignKey("User.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("bank_activity", sa.Boolean(), nullable=False),
    sa.Column("budget_alerts", sa.Boolean(), nullable=False),
    sa.Column("payment_reminders", sa.Boolean(), nullable=False),
    sa.Column("monthly_summary", sa.Boolean(), nullable=False),
    sa.Column("timezone", sa.String(64), nullable=False),
    sa.Column("quiet_start", sa.Integer()),
    sa.Column("quiet_end", sa.Integer()))
  op.create_table("notification_deliveries",
    sa.Column("id", sa.String(36), primary_key=True),
    sa.Column("notification_id", sa.String(), sa.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False),
    sa.Column("subscription_id", sa.String(), sa.ForeignKey("push_subscriptions.id", ondelete="CASCADE"), nullable=False),
    sa.Column("status", sa.String(24), nullable=False),
    sa.Column("attempts", sa.Integer(), nullable=False),
    sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
    sa.Column("last_error", sa.String(64)),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint("notification_id", "subscription_id", name="uq_notification_delivery_subscription"))
  op.create_index("ix_notification_delivery_pending", "notification_deliveries", ["status", "next_attempt_at"])


def downgrade() -> None:
  op.drop_table("notification_deliveries")
  op.drop_table("notification_preferences")
  op.drop_table("notifications")
  op.drop_table("push_subscriptions")
