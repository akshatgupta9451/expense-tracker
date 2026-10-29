"""align schema with spec: users.name, transactions.title, budgets.monthly_limit

Renames are done in place (not drop + add) so existing data is preserved.

Revision ID: 7c1d4e2a9b30
Revises: 2b678f9e85cf
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7c1d4e2a9b30"
down_revision: str | None = "2b678f9e85cf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # users.full_name -> users.name
    op.alter_column("users", "full_name", new_column_name="name")

    # transactions: add required title, backfilled from the old short description.
    # description becomes long-form text: it keeps the old notes, plus the old description
    # only when that was too long to fit in the title.
    op.add_column("transactions", sa.Column("title", sa.String(120), nullable=True))
    op.execute(
        "UPDATE transactions SET title = COALESCE(NULLIF(LEFT(description, 120), ''), 'Untitled')"
    )
    op.alter_column("transactions", "title", nullable=False)
    op.alter_column(
        "transactions", "description", type_=sa.Text(), existing_type=sa.String(255)
    )
    op.execute(
        """
        UPDATE transactions
        SET description = CASE
            WHEN LENGTH(description) > 120
                THEN NULLIF(CONCAT_WS(E'\\n\\n', description, notes), '')
            ELSE notes
        END
        """
    )
    op.drop_column("transactions", "notes")

    # budgets.amount -> budgets.monthly_limit (Postgres rewrites the CHECK expression itself)
    op.alter_column("budgets", "amount", new_column_name="monthly_limit")
    op.execute(
        "ALTER TABLE budgets RENAME CONSTRAINT ck_budgets_amount_positive "
        "TO ck_budgets_monthly_limit_positive"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE budgets RENAME CONSTRAINT ck_budgets_monthly_limit_positive "
        "TO ck_budgets_amount_positive"
    )
    op.alter_column("budgets", "monthly_limit", new_column_name="amount")

    op.add_column("transactions", sa.Column("notes", sa.Text(), nullable=True))
    # Old schema had a 255-char description: keep the title there, move long text to notes.
    op.execute("UPDATE transactions SET notes = description")
    op.execute("UPDATE transactions SET description = LEFT(title, 255)")
    op.alter_column(
        "transactions", "description", type_=sa.String(255), existing_type=sa.Text()
    )
    op.drop_column("transactions", "title")

    op.alter_column("users", "name", new_column_name="full_name")
