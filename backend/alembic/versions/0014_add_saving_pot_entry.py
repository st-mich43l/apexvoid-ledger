"""add saving pot immutable ledger entries

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-13

Backfills existing Saving Pot balances without changing them:

- monthly applications that share the pot currency become historical
  ``month_apply`` ledger rows
- the residual (opening + prior manual adjustments) becomes one
  ``legacy_baseline`` row so entry totals still equal ``SavingPot.balance``

If a monthly application currency disagrees with the pot currency, only a
single ``legacy_baseline`` equal to the full balance is written (no fabricated
cross-currency monthly history).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.sql import table, column

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "SavingPotEntry",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("savingPotId", sa.String(), nullable=False),
    sa.Column("entryType", sa.String(length=32), nullable=False),
    sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("year", sa.Integer(), nullable=True),
    sa.Column("month", sa.Integer(), nullable=True),
    sa.Column("note", sa.String(length=240), nullable=True),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["savingPotId"], ["SavingPot.id"], ondelete="CASCADE"),
    sa.CheckConstraint(
      '"entryType" IN ('
      "'opening', 'manual_add', 'manual_subtract', 'balance_correction', "
      "'month_apply', 'month_reconciliation', 'legacy_baseline'"
      ")",
      name="ck_saving_pot_entry_type",
    ),
    sa.CheckConstraint(
      "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
      name="ck_saving_pot_entry_currency",
    ),
    sa.CheckConstraint(
      '("month" IS NULL AND "year" IS NULL) OR '
      '("month" IS NOT NULL AND "year" IS NOT NULL AND "month" >= 1 AND "month" <= 12)',
      name="ck_saving_pot_entry_year_month",
    ),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(
    "ix_saving_pot_entry_pot_created",
    "SavingPotEntry",
    ["savingPotId", "createdAt"],
  )

  bind = op.get_bind()
  pots = bind.execute(
    sa.text('SELECT id, balance, currency, "createdAt" FROM "SavingPot"')
  ).mappings().all()
  apps = bind.execute(
    sa.text(
      'SELECT id, "savingPotId", year, month, "amountApplied", currency, "appliedAt" '
      'FROM "SavingPotMonthApplication"'
    )
  ).mappings().all()
  apps_by_pot: dict[str, list] = {}
  for app in apps:
    apps_by_pot.setdefault(app["savingPotId"], []).append(app)

  entry_table = table(
    "SavingPotEntry",
    column("id", sa.String),
    column("savingPotId", sa.String),
    column("entryType", sa.String),
    column("amount", sa.Numeric),
    column("currency", sa.String),
    column("year", sa.Integer),
    column("month", sa.Integer),
    column("note", sa.String),
    column("createdAt", sa.DateTime),
  )

  import uuid
  from decimal import Decimal

  rows = []
  for pot in pots:
    pot_apps = apps_by_pot.get(pot["id"], [])
    currency_mismatch = any(app["currency"] != pot["currency"] for app in pot_apps)
    balance = Decimal(str(pot["balance"]))

    if currency_mismatch:
      if balance != 0:
        rows.append(
          {
            "id": str(uuid.uuid4()),
            "savingPotId": pot["id"],
            "entryType": "legacy_baseline",
            "amount": balance,
            "currency": pot["currency"],
            "year": None,
            "month": None,
            "note": "Pre-ledger balance (monthly history omitted due to currency mismatch)",
            "createdAt": pot["createdAt"],
          }
        )
      continue

    monthly_total = sum((Decimal(str(app["amountApplied"])) for app in pot_apps), Decimal("0"))
    legacy = (balance - monthly_total).quantize(Decimal("0.01"))
    if legacy != 0:
      rows.append(
        {
          "id": str(uuid.uuid4()),
          "savingPotId": pot["id"],
          "entryType": "legacy_baseline",
          "amount": legacy,
          "currency": pot["currency"],
          "year": None,
          "month": None,
          "note": "Opening balance and manual adjustments before ledger tracking",
          "createdAt": pot["createdAt"],
        }
      )

    for app in sorted(pot_apps, key=lambda item: (item["year"], item["month"])):
      amount = Decimal(str(app["amountApplied"]))
      if amount == 0:
        continue
      rows.append(
        {
          "id": str(uuid.uuid4()),
          "savingPotId": pot["id"],
          "entryType": "month_apply",
          "amount": amount,
          "currency": pot["currency"],
          "year": app["year"],
          "month": app["month"],
          "note": None,
          "createdAt": app["appliedAt"],
        }
      )

  if rows:
    op.bulk_insert(entry_table, rows)


def downgrade() -> None:
  op.drop_index("ix_saving_pot_entry_pot_created", table_name="SavingPotEntry")
  op.drop_table("SavingPotEntry")
