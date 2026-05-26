"""Seed users and initial rule version"""

import uuid
from datetime import datetime, timezone
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.config import get_settings
from app.models.user import User
from app.models.rule_version import RuleVersion


def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


DEFAULT_RULES = {
    "version": 1,
    "rules": [
        {
            "id": "insurance-gate",
            "type": "value_threshold",
            "condition": {"field": "value_eur", "operator": "gt", "value": 1000},
            "action": "INSURANCE_HOLD",
            "priority": 1,
            "description": "Parcels over €1,000 require insurance approval",
        },
        {
            "id": "mail-dept",
            "type": "weight_range",
            "condition": {"field": "weight_kg", "operator": "lte", "value": 1},
            "action": "ROUTE_TO",
            "target": "Mail Department",
            "priority": 2,
        },
        {
            "id": "regular-dept",
            "type": "weight_range",
            "condition": {"field": "weight_kg", "operator": "lte", "value": 10},
            "action": "ROUTE_TO",
            "target": "Regular Department",
            "priority": 3,
        },
        {
            "id": "heavy-dept",
            "type": "weight_range",
            "condition": {"field": "weight_kg", "operator": "gt", "value": 10},
            "action": "ROUTE_TO",
            "target": "Heavy Department",
            "priority": 4,
        },
    ],
    "fallback": "DEAD_LETTER",
}


def seed():
    engine = create_engine(get_settings().sync_database_url)
    Session = sessionmaker(engine)
    with Session() as db:
        # Check if already seeded
        existing = db.query(User).filter_by(username="admin").first()
        if existing:
            print("Already seeded. Skipping.")
            return

        admin_id = uuid.uuid4()
        users = [
            User(
                id=admin_id,
                username="admin",
                email="admin@parcels.io",
                password_hash=hash_pw("admin123"),
                role="admin",
            ),
            User(
                id=uuid.uuid4(),
                username="viewer",
                email="viewer@parcels.io",
                password_hash=hash_pw("viewer123"),
                role="viewer",
            ),
            User(
                id=uuid.uuid4(),
                username="jsmith",
                email="jsmith@parcels.io",
                password_hash=hash_pw("user123"),
                role="user",
            ),
        ]
        db.add_all(users)
        db.flush()

        rv = RuleVersion(
            id=uuid.uuid4(),
            version_number=1,
            config=DEFAULT_RULES,
            applied_at=datetime.now(timezone.utc),
            applied_by=admin_id,
            is_active=True,
        )
        db.add(rv)
        db.commit()
        print("Seed complete: admin / viewer / jsmith + default rule version.")


if __name__ == "__main__":
    seed()
