import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChartNoAxesCombined,
  ChefHat,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SETTINGS_KEY = "foodwise_app_settings_v1";

import useConsumptionRecords from "../hooks/useConsumptionRecords";

function loadSafetyBuffer() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);

    if (!saved) return 10;

    const settings = JSON.parse(saved);
    const buffer = Number(settings.safetyBuffer);

    if (!Number.isFinite(buffer)) return 10;

    return Math.min(100, Math.max(0, buffer));
  } catch {
    return 10;
  }
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
    },
  );
}

function getFutureDate(daysAhead) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DemandForecasting() {
  const { records, loading, error } = useConsumptionRecords();
  const safetyBuffer = useMemo(() => loadSafetyBuffer(), []);

  const foodItems = useMemo(() => {
    return [
      ...new Set(
        records
          .map((record) => record.foodItem)
          .filter(Boolean),
      ),
    ].sort();
  }, [records]);

  const [selectedFood, setSelectedFood] = useState(
    foodItems[0] || "",
  );
  const [selectedUnit, setSelectedUnit] = useState("");
  const activeFood = foodItems.includes(selectedFood)
    ? selectedFood
    : foodItems[0] || "";

  const recordsForFood = useMemo(() => {
    return records.filter(
      (record) => record.foodItem === activeFood,
    );
  }, [records, activeFood]);

  const units = useMemo(() => {
    return [
      ...new Set(
        recordsForFood.map((record) => record.unit || "units"),
      ),
    ];
  }, [recordsForFood]);
  const activeUnit = units.includes(selectedUnit)
    ? selectedUnit
    : units[0] || "";

  const foodRecords = useMemo(() => recordsForFood.filter(
    (record) => (record.unit || "units") === activeUnit
  ), [recordsForFood, activeUnit]);

  const dailyHistory = useMemo(() => {
    const grouped = {};

    foodRecords.forEach((record) => {
      if (!record.date) return;

      if (!grouped[record.date]) {
        grouped[record.date] = {
          date: record.date,
          consumed: 0,
          prepared: 0,
        };
      }

      grouped[record.date].consumed +=
        Number(record.consumed) || 0;

      grouped[record.date].prepared +=
        Number(record.prepared) || 0;
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
  }, [foodRecords]);

  const averageDemand = useMemo(() => {
    if (dailyHistory.length === 0) return 0;

    const total = dailyHistory.reduce(
      (sum, day) => sum + day.consumed,
      0,
    );

    return total / dailyHistory.length;
  }, [dailyHistory]);

  const [forecastMethod, setForecastMethod] = useState("recent");
  const nextDayForecast = useMemo(() => {
    if (!dailyHistory.length) return 0;
    const observations = dailyHistory.slice(-7).map((day) => day.consumed);
    if (forecastMethod === "average" || observations.length === 1) {
      return observations.reduce((sum, value) => sum + value, 0) /
        observations.length;
    }

    const totalWeight = observations.reduce(
      (sum, _value, index) => sum + index + 1,
      0
    );
    return observations.reduce(
      (sum, value, index) => sum + value * (index + 1),
      0
    ) / totalWeight;
  }, [dailyHistory, forecastMethod]);
  const sevenDayForecast = nextDayForecast * 7;

  const suggestedPreparation = Math.ceil(
    nextDayForecast * (1 + safetyBuffer / 100),
  );


  const chartData = useMemo(() => {
    const historical = dailyHistory.map((day) => ({
      label: formatDate(day.date),
      actual: Number(day.consumed.toFixed(2)),
      forecast: null,
    }));

    if (dailyHistory.length === 0) return [];

    const future = Array.from({ length: 7 }, (_, index) => {
      const date = getFutureDate(index + 1);

      return {
        label: formatDate(date),
        actual: null,
        forecast: Number(nextDayForecast.toFixed(2)),
      };
    });

    if (historical.length > 0) {
      historical[historical.length - 1].forecast =
        Number(nextDayForecast.toFixed(2));
    }

    return [...historical, ...future];
  }, [dailyHistory, nextDayForecast]);

  const backtest = useMemo(() => {
    if (dailyHistory.length < 3) return null;

    const observations = dailyHistory.map((day) => day.consumed);
    let absoluteError = 0;
    let totalActual = 0;
    let predictions = 0;

    for (let index = 2; index < observations.length; index += 1) {
      const history = observations.slice(Math.max(0, index - 7), index);
      let estimate;
      if (forecastMethod === "average") {
        estimate = history.reduce((sum, value) => sum + value, 0) / history.length;
      } else {
        const weight = history.reduce((sum, _value, itemIndex) => sum + itemIndex + 1, 0);
        estimate = history.reduce(
          (sum, value, itemIndex) => sum + value * (itemIndex + 1),
          0
        ) / weight;
      }
      absoluteError += Math.abs(observations[index] - estimate);
      totalActual += observations[index];
      predictions += 1;
    }

    return {
      meanAbsoluteError: absoluteError / predictions,
      weightedAbsolutePercentageError: totalActual > 0
        ? (absoluteError / totalActual) * 100
        : null,
    };
  }, [dailyHistory, forecastMethod]);

  const confidenceMessage = useMemo(() => {
    if (dailyHistory.length === 0) {
      return "No consumption history is available. Add consumption records before generating a forecast.";
    }

    if (dailyHistory.length < 3) {
      return "Very limited history: this preliminary estimate uses fewer than three recorded dates. Record more daily consumption before relying on it.";
    }

    if (dailyHistory.length < 7) {
      return "Limited history: this baseline uses the available recorded dates. More consistent records can improve the usefulness of future forecasts.";
    }

    return "This is a historical-average baseline using up to seven recorded dates. It is not yet a trained machine-learning prediction.";
  }, [dailyHistory]);

  const currentUnit =
    units.length === 1 ? units[0] : units.length > 1 ? "mixed units" : "units";

  return (
    <section className="demand-forecast-page">
      <div className="demand-forecast-heading">
        <div>
          <span className="eyebrow">
            ANALYTICS / DEMAND PLANNING
          </span>

          <h1>Demand Forecasting</h1>

          <p>
            Estimate upcoming food demand using your recorded
            consumption history.
          </p>
        </div>

        <div className="demand-forecast-method">
          <Activity size={17} />
          {forecastMethod === "recent" ? "Recent-weighted baseline" : "Simple-average baseline"}
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="demand-forecast-selector">
        <label htmlFor="forecast-food-select">
          <span>Select Food Item</span>

          <select
            id="forecast-food-select"
            value={activeFood}
            onChange={(event) =>
              setSelectedFood(event.target.value)
            }
          >
            {loading && <option value="">Loading records...</option>}
            {!loading && foodItems.length === 0 && (
              <option value="">
                No consumption records available
              </option>
            )}

            {foodItems.map((food) => (
              <option key={food} value={food}>
                {food}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="forecast-unit-select">
          <span>Measurement Unit</span>
          <select
            id="forecast-unit-select"
            value={activeUnit}
            onChange={(event) => setSelectedUnit(event.target.value)}
            disabled={!units.length}
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </label>

        <label htmlFor="forecast-method-select">
          <span>Forecast Method</span>
          <select
            id="forecast-method-select"
            value={forecastMethod}
            onChange={(event) => setForecastMethod(event.target.value)}
          >
            <option value="recent">Recent-weighted average (7 dates)</option>
            <option value="average">Simple average (7 dates)</option>
          </select>
        </label>

        <div className="forecast-history-count">
          <CalendarDays size={18} />

          <span>
            {dailyHistory.length} recorded date
            {dailyHistory.length === 1 ? "" : "s"} available
          </span>
        </div>
      </div>

      <div className="forecast-method-notice">
        <AlertCircle size={20} />

        <div>
          <strong>Forecast methodology</strong>

          <p>{confidenceMessage}</p>
        </div>
      </div>

      <div className="forecast-kpi-grid">
        <article className="forecast-kpi-card">
          <div className="forecast-kpi-icon">
            <ChefHat size={21} />
          </div>

          <span>Average Daily Consumption</span>

          <strong>
            {formatNumber(averageDemand)}
          </strong>

          <small>{currentUnit} per recorded date</small>
        </article>

        <article className="forecast-kpi-card">
          <div className="forecast-kpi-icon">
            <Activity size={21} />
          </div>

          <span>Historical Backtest Error</span>

          <strong>
            {backtest?.weightedAbsolutePercentageError === null ||
            !backtest
              ? "—"
              : `${formatNumber(backtest.weightedAbsolutePercentageError)}%`}
          </strong>

          <small>
            {backtest
              ? `${formatNumber(backtest.meanAbsoluteError)} ${currentUnit} mean absolute error · walk-forward`
              : "At least 3 recorded dates required"}
          </small>
        </article>

        <article className="forecast-kpi-card">
          <div className="forecast-kpi-icon">
            <TrendingUp size={21} />
          </div>

          <span>Next-Day Demand Estimate</span>

          <strong>
            {formatNumber(nextDayForecast)}
          </strong>

          <small>
            {currentUnit} · {formatDate(getFutureDate(1))}
          </small>
        </article>

        <article className="forecast-kpi-card">
          <div className="forecast-kpi-icon">
            <CalendarDays size={21} />
          </div>

          <span>Next 7-Day Demand Estimate</span>

          <strong>
            {formatNumber(sevenDayForecast)}
          </strong>

          <small>{currentUnit} over seven days</small>
        </article>

        <article className="forecast-kpi-card">
          <div className="forecast-kpi-icon">
            <ChartNoAxesCombined size={21} />
          </div>

          <span>Historical Dates Available</span>

          <strong>{dailyHistory.length}</strong>

          <small>Distinct dates with recorded consumption</small>
        </article>
      </div>

      <article className="forecast-chart-card">
        <div className="forecast-chart-heading">
          <div>
            <h2>Consumption History & Forecast</h2>

            <p>
              Actual recorded consumption compared with the
              baseline estimate.
            </p>
          </div>

          <ChartNoAxesCombined size={22} />
        </div>

        {loading ? (
          <div className="forecast-empty-state">Loading consumption history...</div>
        ) : chartData.length > 0 ? (
          <div className="forecast-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 12,
                  right: 15,
                  left: 0,
                  bottom: 8,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                />

                <YAxis tick={{ fontSize: 12 }} />

                <Tooltip
                  formatter={(value, name) => [
                    `${formatNumber(value)} ${currentUnit}`,
                    name === "actual"
                      ? "Actual consumption"
                      : "Baseline estimate",
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual consumption"
                  stroke="#299764"
                  strokeWidth={3}
                  connectNulls={false}
                  dot={{ r: 4 }}
                />

                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Baseline estimate"
                  stroke="#e58b45"
                  strokeWidth={3}
                  strokeDasharray="6 5"
                  connectNulls={false}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="forecast-empty-state">
            <ChartNoAxesCombined size={36} />

            <h3>No forecast data yet</h3>

            <p>
              Add a consumption record to generate a preliminary
              demand estimate for this food item.
            </p>
          </div>
        )}
      </article>

      <article className="forecast-recommendation-card">
        <div className="forecast-recommendation-icon">
          <Lightbulb size={23} />
        </div>

        <div className="forecast-recommendation-content">
          <span>PREPARATION GUIDANCE</span>

          <h2>
            {dailyHistory.length === 0
              ? "Start collecting consumption data"
              : `Review preparation quantities for ${selectedFood}`}
          </h2>

          {dailyHistory.length === 0 ? (
            <p>
              Record daily preparation and consumption to begin
              estimating demand.
            </p>
          ) : (
            <p>
              The selected historical baseline estimates demand at
              approximately{" "}
              <strong>
                {formatNumber(nextDayForecast)} {currentUnit}
              </strong>{" "}
              for the next planning day. With your configured safety
              buffer of {safetyBuffer}%, the suggested preparation
              quantity is{" "}
              <strong>
                {formatNumber(suggestedPreparation)} {currentUnit}
              </strong>
              . Consider attendance, menu changes, expected demand,
              and available capacity before deciding how much to prepare.
            </p>
          )}
        </div>
      </article>

      <div className="forecast-disclaimer">
        These estimates are based on recorded consumption, not
        verified future demand. The baseline does not account
        for holidays, attendance, weather, menu changes, or
        special events. Advanced forecasting models and
        historical accuracy evaluation can be added in a later
        stage.
      </div>
    </section>
  );
}