# FoodWise AI

FoodWise AI is a React dashboard backed by a Flask API and SQLite database. It
supports inventory management, consumption and waste tracking, CSV import,
demand baselines, waste analytics, recommendations, reports, and workspace
settings.

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.10+

## Run locally on Windows

Open two terminals from the project root.

### Backend

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r requirements.txt
backend\.venv\Scripts\python.exe -m backend.app
```

The API starts at `http://127.0.0.1:5000`. The SQLite database is created at
`backend\foodwise.db` when the service starts.

### Frontend

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
Vite proxies `/api` requests to the local Flask service.

## Checks

```powershell
npm run lint
npm run build
npm run test:backend
```

## API

- `GET /api/health`
- `GET`, `POST`, `PUT`, and `DELETE /api/food-items`
- `POST /api/food-items/bulk`
- `GET`, `POST`, and `DELETE /api/consumption`
- `PUT` and `DELETE /api/consumption/<id>`
- `POST /api/consumption/bulk`
- `DELETE /api/data` to clear both datasets

The Data Import screen accepts consumption CSVs (`foodItem,date,prepared,consumed,unit`)
and inventory CSVs (`name,quantity,unit`, with optional `category,expiryDate`).
Bulk imports validate the full batch before saving and skip duplicate records or
inventory names.

Set `VITE_API_BASE_URL` at build time when the API is hosted at a different
origin. Set `FOODWISE_DATABASE_URL` to use a different SQLAlchemy database URL.

Consumption records and inventory are stored in the backend database.
Organization preferences are stored in the browser. Forecasting and
recommendations are transparent historical/rule-based estimates, not trained
machine-learning predictions.
