import os
import math
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import date

app = Flask(__name__)

# Allow the local React frontend to communicate with Flask.

CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# Store the SQLite database inside the backend folder.

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "foodwise.db")

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
"FOODWISE_DATABASE_URL",
"sqlite:///" + DATABASE_PATH.replace("\\", "/")
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the database connection.

from .extensions import db
from . import models

db.init_app(app)

with app.app_context():
    db.create_all()


@app.route("/", methods=["GET"])
def home():
    return jsonify({
"success": True,
"message": "Welcome to the FoodWise AI API",
"status": "running"
})

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
"success": True,
"service": "FoodWise AI Backend",
"status": "healthy"
}), 200

# ---------------- FOOD INVENTORY API ----------------

@app.route("/api/food-items", methods=["GET"])
def get_food_items():
    items = models.FoodItem.query.order_by(
        models.FoodItem.id.desc()
    ).all()

    return jsonify({
        "success": True,
        "count": len(items),
        "items": [item.to_dict() for item in items]
    }), 200


@app.route("/api/food-items", methods=["POST"])
def create_food_item():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "A JSON object is required."
        }), 400

    name = data.get("name")

    if not isinstance(name, str) or not name.strip():
        return jsonify({
            "success": False,
            "error": "Food item name is required."
        }), 400

    try:
        quantity = float(data.get("quantity", 0))

        if not math.isfinite(quantity) or quantity < 0:
            raise ValueError

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "Quantity must be a valid non-negative number."
        }), 400

    category = data.get("category", "Other")
    unit = data.get("unit", "kg")

    if not isinstance(category, str) or not category.strip():
        return jsonify({
            "success": False,
            "error": "Category must be a non-empty string."
        }), 400

    if not isinstance(unit, str) or not unit.strip():
        return jsonify({
            "success": False,
            "error": "Unit must be a non-empty string."
        }), 400

    expiry_date = None
    raw_expiry = data.get("expiryDate")

    if raw_expiry:
        try:
            expiry_date = date.fromisoformat(raw_expiry)
        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "error": "Expiry date must use YYYY-MM-DD format."
            }), 400

    item = models.FoodItem(
        name=name.strip(),
        category=category.strip(),
        quantity=quantity,
        unit=unit.strip(),
        expiry_date=expiry_date
    )

    try:
        db.session.add(item)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Food item created successfully.",
            "item": item.to_dict()
        }), 201

    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to create food item.")

        return jsonify({
            "success": False,
            "error": "Unable to save the food item."
        }), 500


@app.route("/api/food-items/<int:item_id>", methods=["GET"])
def get_food_item(item_id):
    item = db.session.get(models.FoodItem, item_id)

    if item is None:
        return jsonify({
            "success": False,
            "error": "Food item not found."
        }), 404

    return jsonify({
        "success": True,
        "item": item.to_dict()
    }), 200


@app.route("/api/food-items/<int:item_id>", methods=["PUT"])
def update_food_item(item_id):
    item = db.session.get(models.FoodItem, item_id)

    if item is None:
        return jsonify({
            "success": False,
            "error": "Food item not found."
        }), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "A JSON object is required."
        }), 400

    if "name" in data:
        if not isinstance(data["name"], str) or not data["name"].strip():
            return jsonify({
                "success": False,
                "error": "Name must be a non-empty string."
            }), 400
        item.name = data["name"].strip()

    if "category" in data:
        if not isinstance(data["category"], str) or not data["category"].strip():
            return jsonify({
                "success": False,
                "error": "Category must be a non-empty string."
            }), 400
        item.category = data["category"].strip()

    if "unit" in data:
        if not isinstance(data["unit"], str) or not data["unit"].strip():
            return jsonify({
                "success": False,
                "error": "Unit must be a non-empty string."
            }), 400
        item.unit = data["unit"].strip()

    if "quantity" in data:
        try:
            quantity = float(data["quantity"])

            if not math.isfinite(quantity) or quantity < 0:
                raise ValueError

            item.quantity = quantity

        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "error": "Quantity must be a valid non-negative number."
            }), 400

    if "expiryDate" in data:
        raw_expiry = data["expiryDate"]

        if raw_expiry in (None, ""):
            item.expiry_date = None
        else:
            try:
                item.expiry_date = date.fromisoformat(raw_expiry)
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "error": "Expiry date must use YYYY-MM-DD format."
                }), 400

    try:
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Food item updated successfully.",
            "item": item.to_dict()
        }), 200

    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to update food item.")

        return jsonify({
            "success": False,
            "error": "Unable to update the food item."
        }), 500


@app.route("/api/food-items/<int:item_id>", methods=["DELETE"])
def delete_food_item(item_id):
    item = db.session.get(models.FoodItem, item_id)

    if item is None:
        return jsonify({
            "success": False,
            "error": "Food item not found."
        }), 404

    try:
        db.session.delete(item)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Food item deleted successfully."
        }), 200

    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to delete food item.")

        return jsonify({
            "success": False,
            "error": "Unable to delete the food item."
        }), 500


@app.route("/api/food-items", methods=["DELETE"])
def delete_all_food_items():
    try:
        deleted_count = models.FoodItem.query.delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "deleted": deleted_count
        }), 200
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to clear food inventory.")
        return jsonify({
            "success": False,
            "error": "Unable to clear food inventory."
        }), 500


@app.route("/api/food-items/bulk", methods=["POST"])
def create_food_items():
    data = request.get_json(silent=True)
    items_data = data.get("items") if isinstance(data, dict) else None

    if not isinstance(items_data, list) or not items_data:
        return jsonify({
            "success": False,
            "error": "A non-empty items array is required."
        }), 400

    if len(items_data) > 5000:
        return jsonify({
            "success": False,
            "error": "A maximum of 5,000 items can be imported at once."
        }), 400

    items = []
    for index, item_data in enumerate(items_data, start=1):
        if not isinstance(item_data, dict):
            return jsonify({
                "success": False,
                "error": f"Item {index}: a JSON object is required."
            }), 400

        name = item_data.get("name")
        category = item_data.get("category", "Other")
        unit = item_data.get("unit", "kg")
        raw_expiry = item_data.get("expiryDate")

        if not isinstance(name, str) or not name.strip():
            return jsonify({
                "success": False,
                "error": f"Item {index}: name is required."
            }), 400
        if not isinstance(category, str) or not category.strip():
            return jsonify({
                "success": False,
                "error": f"Item {index}: category must be a non-empty string."
            }), 400
        if not isinstance(unit, str) or not unit.strip():
            return jsonify({
                "success": False,
                "error": f"Item {index}: unit must be a non-empty string."
            }), 400

        try:
            quantity = float(item_data.get("quantity"))
            if not math.isfinite(quantity) or quantity < 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "error": f"Item {index}: quantity must be a valid non-negative number."
            }), 400

        expiry_date = None
        if raw_expiry not in (None, ""):
            try:
                if not isinstance(raw_expiry, str):
                    raise ValueError
                expiry_date = date.fromisoformat(raw_expiry)
                if expiry_date.isoformat() != raw_expiry:
                    raise ValueError
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "error": f"Item {index}: expiry date must use YYYY-MM-DD format."
                }), 400

        items.append(models.FoodItem(
            name=name.strip(),
            category=category.strip(),
            quantity=quantity,
            unit=unit.strip(),
            expiry_date=expiry_date
        ))

    try:
        existing_names = {
            item.name.strip().casefold()
            for item in models.FoodItem.query.all()
        }
        unique_items = []
        for item in items:
            key = item.name.casefold()
            if key not in existing_names:
                unique_items.append(item)
                existing_names.add(key)

        if unique_items:
            db.session.add_all(unique_items)
            db.session.commit()
        return jsonify({
            "success": True,
            "count": len(unique_items),
            "skipped": len(items) - len(unique_items),
            "items": [item.to_dict() for item in unique_items]
        }), 201
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to import food inventory.")
        return jsonify({
            "success": False,
            "error": "Unable to import food inventory."
        }), 500


# ---------------- CONSUMPTION API ----------------

@app.route("/api/consumption", methods=["GET"])
def get_consumption_records():
    records = models.ConsumptionRecord.query.order_by(
        models.ConsumptionRecord.date.desc(),
        models.ConsumptionRecord.id.desc()
    ).all()

    return jsonify({
        "success": True,
        "count": len(records),
        "records": [record.to_dict() for record in records]
    }), 200


def parse_consumption_record(data):
    if not isinstance(data, dict):
        return None, "A valid JSON object is required."

    food_item = data.get("foodItem")
    record_date = data.get("date")
    unit = data.get("unit", "kg")
    notes = data.get("notes", "")

    if not isinstance(food_item, str) or not food_item.strip():
        return None, "Food item is required."

    if not isinstance(record_date, str):
        return None, "Enter a valid date in YYYY-MM-DD format."

    try:
        parsed_date = date.fromisoformat(record_date)
        if parsed_date.isoformat() != record_date:
            raise ValueError
        prepared = float(data.get("prepared"))
        consumed = float(data.get("consumed"))
    except (TypeError, ValueError):
        return None, "Enter a valid date, prepared quantity, and consumed quantity."

    if parsed_date > date.today():
        return None, "Consumption records cannot have a future date."

    if not math.isfinite(prepared) or not math.isfinite(consumed):
        return None, "Quantities must be valid finite numbers."

    if prepared <= 0 or consumed < 0 or consumed > prepared:
        return None, (
            "Prepared quantity must be positive, and consumed quantity "
            "must be between zero and prepared quantity."
        )

    if not isinstance(unit, str) or not unit.strip():
        return None, "A valid unit is required."

    if not isinstance(notes, str):
        return None, "Notes must be text."

    return models.ConsumptionRecord(
        food_item=food_item.strip(),
        date=parsed_date,
        prepared=prepared,
        consumed=consumed,
        wasted=prepared - consumed,
        unit=unit.strip(),
        notes=notes.strip()
    ), None


@app.route("/api/consumption", methods=["POST"])
def create_consumption_record():
    data = request.get_json(silent=True)
    record, error = parse_consumption_record(data)
    if error:
        return jsonify({
            "success": False,
            "message": error,
            "error": error
        }), 400

    try:
        db.session.add(record)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Consumption record created successfully.",
            "record": record.to_dict()
        }), 201

    except Exception:
        db.session.rollback()
        app.logger.exception("Failed to create consumption record.")
        return jsonify({
            "success": False,
            "message": "Unable to save the consumption record."
        }), 500


@app.route("/api/consumption/<int:record_id>", methods=["PUT"])
def update_consumption_record(record_id):
    existing = db.session.get(models.ConsumptionRecord, record_id)
    if existing is None:
        return jsonify({
            "success": False,
            "message": "Consumption record not found."
        }), 404

    record, error = parse_consumption_record(request.get_json(silent=True))
    if error:
        return jsonify({
            "success": False,
            "message": error,
            "error": error
        }), 400

    existing.food_item = record.food_item
    existing.date = record.date
    existing.prepared = record.prepared
    existing.consumed = record.consumed
    existing.wasted = record.wasted
    existing.unit = record.unit
    existing.notes = record.notes

    try:
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Consumption record updated successfully.",
            "record": existing.to_dict()
        }), 200
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to update consumption record.")
        return jsonify({
            "success": False,
            "message": "Unable to update the consumption record."
        }), 500


@app.route("/api/consumption/bulk", methods=["POST"])
def create_consumption_records():
    data = request.get_json(silent=True)
    records_data = data.get("records") if isinstance(data, dict) else None

    if not isinstance(records_data, list) or not records_data:
        return jsonify({
            "success": False,
            "message": "A non-empty records array is required."
        }), 400

    if len(records_data) > 5000:
        return jsonify({
            "success": False,
            "message": "A maximum of 5,000 records can be imported at once."
        }), 400

    records = []
    for index, record_data in enumerate(records_data, start=1):
        record, error = parse_consumption_record(record_data)
        if error:
            return jsonify({
                "success": False,
                "message": f"Record {index}: {error}"
            }), 400
        records.append(record)

    def duplicate_key(record):
        return (
            record.food_item.casefold(),
            record.date,
            record.prepared,
            record.consumed,
            record.unit.casefold(),
        )

    try:
        existing_keys = {
            duplicate_key(record)
            for record in models.ConsumptionRecord.query.all()
        }
        unique_records = []
        for record in records:
            key = duplicate_key(record)
            if key not in existing_keys:
                unique_records.append(record)
                existing_keys.add(key)

        if unique_records:
            db.session.add_all(unique_records)
            db.session.commit()
        return jsonify({
            "success": True,
            "count": len(unique_records),
            "skipped": len(records) - len(unique_records),
            "records": [record.to_dict() for record in unique_records]
        }), 201
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to import consumption records.")
        return jsonify({
            "success": False,
            "message": "Unable to import the consumption records."
        }), 500


@app.route("/api/consumption/<int:record_id>", methods=["DELETE"])
def delete_consumption_record(record_id):
    record = db.session.get(models.ConsumptionRecord, record_id)
    if record is None:
        return jsonify({
            "success": False,
            "message": "Consumption record not found."
        }), 404

    try:
        db.session.delete(record)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Consumption record deleted successfully."
        }), 200
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to delete consumption record.")
        return jsonify({
            "success": False,
            "message": "Unable to delete the consumption record."
        }), 500


@app.route("/api/consumption", methods=["DELETE"])
def delete_all_consumption_records():
    try:
        deleted_count = models.ConsumptionRecord.query.delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "deleted": deleted_count
        }), 200
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to clear consumption records.")
        return jsonify({
            "success": False,
            "message": "Unable to clear consumption records."
        }), 500


@app.route("/api/data", methods=["DELETE"])
def delete_all_application_data():
    try:
        deleted_consumption = models.ConsumptionRecord.query.delete()
        deleted_inventory = models.FoodItem.query.delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "deleted": {
                "consumption": deleted_consumption,
                "inventory": deleted_inventory
            }
        }), 200
    except Exception:
        db.session.rollback()
        app.logger.exception("Unable to clear application data.")
        return jsonify({
            "success": False,
            "message": "Unable to clear application data."
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
