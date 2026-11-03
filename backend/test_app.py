import os
import unittest

os.environ["FOODWISE_DATABASE_URL"] = "sqlite://"

from backend.app import app, db


class FoodWiseApiTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.app_context = app.app_context()
        self.app_context.push()
        db.drop_all()
        db.create_all()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_inventory_create_update_list_and_delete(self):
        created = self.client.post("/api/food-items", json={
            "name": "Tomatoes",
            "category": "Vegetables",
            "quantity": 12,
            "unit": "kg",
            "expiryDate": "2026-11-10",
        })
        self.assertEqual(created.status_code, 201)
        item_id = created.json["item"]["id"]
        self.assertEqual(self.client.get("/api/food-items").json["count"], 1)

        updated = self.client.put(
            f"/api/food-items/{item_id}",
            json={"quantity": 8},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["item"]["quantity"], 8)
        self.assertEqual(
            self.client.delete(f"/api/food-items/{item_id}").status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/food-items").json["count"], 0)

    def test_consumption_create_update_list_and_delete(self):
        payload = {
            "foodItem": "Rice",
            "date": "2026-11-03",
            "prepared": 10,
            "consumed": 8,
            "unit": "kg",
            "notes": "Lunch service",
        }
        created = self.client.post("/api/consumption", json=payload)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["record"]["wasted"], 2)
        record_id = created.json["record"]["id"]

        updated = self.client.put(
            f"/api/consumption/{record_id}",
            json={**payload, "prepared": 12, "consumed": 9},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["record"]["wasted"], 3)
        self.assertEqual(self.client.get("/api/consumption").json["count"], 1)
        self.assertEqual(
            self.client.delete(f"/api/consumption/{record_id}").status_code,
            200,
        )

    def test_bulk_import_is_validated_atomic_and_idempotent(self):
        first = {
            "foodItem": "Rice",
            "date": "2026-11-03",
            "prepared": 10,
            "consumed": 8,
            "unit": "kg",
        }
        invalid_batch = self.client.post("/api/consumption/bulk", json={
            "records": [first, {**first, "prepared": -1}],
        })
        self.assertEqual(invalid_batch.status_code, 400)
        self.assertEqual(self.client.get("/api/consumption").json["count"], 0)
        future_record = self.client.post("/api/consumption", json={
            **first,
            "date": "2099-01-01",
        })
        self.assertEqual(future_record.status_code, 400)

        imported = self.client.post("/api/consumption/bulk", json={
            "records": [first, first],
        })
        self.assertEqual(imported.status_code, 201)
        self.assertEqual(imported.json["count"], 1)
        self.assertEqual(imported.json["skipped"], 1)
        self.assertEqual(self.client.get("/api/consumption").json["count"], 1)

    def test_inventory_bulk_import_skips_existing_names(self):
        tomato = {
            "name": "Tomatoes",
            "category": "Vegetables",
            "quantity": 12,
            "unit": "kg",
            "expiryDate": "2026-11-10",
        }
        response = self.client.post("/api/food-items/bulk", json={
            "items": [tomato, tomato],
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["count"], 1)
        self.assertEqual(response.json["skipped"], 1)
        self.assertEqual(self.client.get("/api/food-items").json["count"], 1)

        invalid = self.client.post("/api/food-items/bulk", json={
            "items": [{**tomato, "quantity": "NaN"}],
        })
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.get("/api/food-items").json["count"], 1)

    def test_application_data_can_be_cleared(self):
        self.client.post("/api/food-items", json={
            "name": "Tomatoes",
            "quantity": 4,
            "unit": "kg",
        })
        self.client.post("/api/consumption", json={
            "foodItem": "Rice",
            "date": "2026-11-03",
            "prepared": 10,
            "consumed": 8,
            "unit": "kg",
        })

        response = self.client.delete("/api/data")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/food-items").json["count"], 0)
        self.assertEqual(self.client.get("/api/consumption").json["count"], 0)


if __name__ == "__main__":
    unittest.main()
