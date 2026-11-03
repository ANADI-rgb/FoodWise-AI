from datetime import datetime, timezone

from .extensions import db

class FoodItem(db.Model):
    __tablename__ = "food_items"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    category = db.Column(db.String(80), nullable=False, default="Other")
    quantity = db.Column(db.Float, nullable=False, default=0)
    unit = db.Column(db.String(30), nullable=False, default="kg")
    expiry_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(
            db.DateTime,
            nullable=False,
            default=lambda: datetime.now(timezone.utc),
        )

    def to_dict(self):
        return {
        "id": self.id,
        "name": self.name,
        "category": self.category,
        "quantity": self.quantity,
        "unit": self.unit,
        "expiryDate": (
            self.expiry_date.isoformat()
            if self.expiry_date
            else None
        ),
        "createdAt": (
            self.created_at.isoformat()
            if self.created_at
            else None
        ),
    }


class ConsumptionRecord(db.Model):
    __tablename__ = "consumption_records"

    id = db.Column(db.Integer, primary_key=True)
    food_item = db.Column(db.String(120), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    prepared = db.Column(db.Float, nullable=False, default=0)
    consumed = db.Column(db.Float, nullable=False, default=0)
    wasted = db.Column(db.Float, nullable=False, default=0)
    unit = db.Column(db.String(30), nullable=False, default="kg")
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
        "id": self.id,
        "foodItem": self.food_item,
        "date": self.date.isoformat(),
        "prepared": self.prepared,
        "consumed": self.consumed,
        "wasted": self.wasted,
        "unit": self.unit,
        "notes": self.notes or "",
        "createdAt": (
            self.created_at.isoformat()
            if self.created_at
            else None
        ),
    }
