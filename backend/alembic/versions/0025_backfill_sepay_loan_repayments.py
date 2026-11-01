"""backfill historical SePay loan repayment expenses

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-01
"""
from datetime import datetime, timezone
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  """Repair only the legacy rows that the old bank-only flow left unlinked."""
  bind = op.get_bind()
  activities = bind.execute(
    sa.text(
      '''
      SELECT id, "userId", provider, "providerTransactionId", amount, currency,
             "occurredAt", description
      FROM "SePayBankActivity"
      WHERE classification = 'loan_repayment'
        AND direction = 'out'
        AND "linkedTransactionId" IS NULL
        AND "userId" IS NOT NULL
      '''
    )
  ).mappings().all()

  now = datetime.now(timezone.utc)
  for activity in activities:
    category_id = bind.execute(
      sa.text(
        '''
        SELECT id FROM "Category"
        WHERE "userId" = :user_id
          AND "categoryType" = 'expense'
          AND "normalizedName" = 'loan'
        '''
      ),
      {"user_id": activity["userId"]},
    ).scalar_one_or_none()
    if category_id is None:
      category_id = str(uuid4())
      bind.execute(
        sa.text(
          '''
          INSERT INTO "Category" (
            id, "userId", name, "normalizedName", "categoryType", icon,
            "isActive", "createdAt", "updatedAt"
          ) VALUES (
            :id, :user_id, 'Loan', 'loan', 'expense', :icon,
            :is_active, :created_at, :updated_at
          )
          '''
        ),
        {
          "id": category_id,
          "user_id": activity["userId"],
          "icon": "🏦",
          "is_active": True,
          "created_at": now,
          "updated_at": now,
        },
      )

    external_id = f"sepay:{activity['provider']}:{activity['providerTransactionId']}"
    transaction_id = bind.execute(
      sa.text(
        '''
        SELECT id FROM "Transaction"
        WHERE "userId" = :user_id
          AND source = 'sepay'
          AND "externalId" = :external_id
        '''
      ),
      {"user_id": activity["userId"], "external_id": external_id},
    ).scalar_one_or_none()
    if transaction_id is None:
      transaction_id = str(uuid4())
      bind.execute(
        sa.text(
          '''
          INSERT INTO "Transaction" (
            id, "userId", "transactionType", "categoryId", amount, currency,
            "occurredAt", description, source, "externalId", "createdAt", "updatedAt"
          ) VALUES (
            :id, :user_id, 'expense', :category_id, :amount, :currency,
            :occurred_at, :description, 'sepay', :external_id, :created_at, :updated_at
          )
          '''
        ),
        {
          "id": transaction_id,
          "user_id": activity["userId"],
          "category_id": category_id,
          "amount": activity["amount"],
          "currency": activity["currency"],
          "occurred_at": activity["occurredAt"],
          "description": activity["description"]
          or f"SePay {activity['providerTransactionId']}",
          "external_id": external_id,
          "created_at": now,
          "updated_at": now,
        },
      )

    bind.execute(
      sa.text(
        '''
        UPDATE "SePayBankActivity"
        SET "linkedTransactionId" = :transaction_id,
            "matchedKind" = NULL,
            "matchedId" = NULL
        WHERE id = :activity_id
          AND "linkedTransactionId" IS NULL
        '''
      ),
      {"transaction_id": transaction_id, "activity_id": activity["id"]},
    )


def downgrade() -> None:
  # Backfilled transactions are durable financial records and must not be
  # deleted if a schema downgrade is ever required.
  pass
