import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChartColumnIncreasing,
  Leaf,
  Recycle,
  TrendingDown,
  Utensils,
} from "lucide-react";
import {
  CartesianGrid,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SETTINGS_KEY = "foodwise_app_settings_v1";

import useConsumptionRecords from "../hooks/useConsumptionRecords";

function readWasteTarget() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);

    if (!saved) return 10;

    const settings = JSON.parse(saved);
    const target = Number(settings.wasteTarget);

    if (!Number.isFinite(target)) return 10;

    return Math.min(100, Math.max(0, target));
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
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function WasteAnalytics() {
  const { records, loading, error } = useConsumptionRecords();
  const wasteTarget = useMemo(() => readWasteTarget(), []);
  const [selectedUnit, setSelectedUnit] = useState("");

  const units = useMemo(() => [...new Set(
    records.map((record) => record.unit || "units")
  )].sort(), [records]);
  const activeUnit = units.includes(selectedUnit)
    ? selectedUnit
    : units[0] || "";
  const filteredRecords = useMemo(
    () => records.filter((record) => (record.unit || "units") === activeUnit),
    [records, activeUnit]
  );

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (result, record) => {
        result.prepared += Number(record.prepared) || 0;
        result.consumed += Number(record.consumed) || 0;
        result.wasted += Number(record.wasted) || 0;
        return result;
      },
      { prepared: 0, consumed: 0, wasted: 0 },
    );
  }, [filteredRecords]);

  const wastePercentage =
  totals.prepared > 0
    ? (totals.wasted / totals.prepared) * 100
    : 0;

  const targetStatus =
  totals.prepared === 0
    ? "no-data"
    : wastePercentage > wasteTarget
      ? "above"
      : wastePercentage === wasteTarget
        ? "at"
        : "below";

  const wasteByFood = useMemo(() => {
    const grouped = {};

    filteredRecords.forEach((record) => {
      const food = record.foodItem || "Other";

      if (!grouped[food]) {
        grouped[food] = {
          foodItem: food,
          prepared: 0,
          consumed: 0,
          wasted: 0,
        };
      }

      grouped[food].prepared += Number(record.prepared) || 0;
      grouped[food].consumed += Number(record.consumed) || 0;
      grouped[food].wasted += Number(record.wasted) || 0;
    });

    return Object.values(grouped).sort((a, b) => b.wasted - a.wasted);
  }, [filteredRecords]);

  const dailyWaste = useMemo(() => {
    const grouped = {};

    filteredRecords.forEach((record) => {
      if (!record.date) return;

      if (!grouped[record.date]) {
        grouped[record.date] = {
          date: record.date,
          prepared: 0,
          consumed: 0,
          wasted: 0,
        };
      }

      grouped[record.date].prepared += Number(record.prepared) || 0;
      grouped[record.date].consumed += Number(record.consumed) || 0;
      grouped[record.date].wasted += Number(record.wasted) || 0;
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map((item) => ({
        ...item,
        label: formatDate(item.date),
      }));
  }, [filteredRecords]);

  const pieData = [
    { name: "Consumed", value: totals.consumed },
    { name: "Wasted", value: totals.wasted },
  ].filter((item) => item.value > 0);

  const highestWasteFood = wasteByFood[0];

  const insights = useMemo(() => {
    if (filteredRecords.length === 0) {
      return [
        {
          title: "Start recording food usage",
          description:
            "Add consumption records to generate meaningful waste analytics and recommendations.",
          type: "info",
        },
      ];
    }

    const results = [];

    if (highestWasteFood && highestWasteFood.wasted > 0) {
      results.push({
        title: `${highestWasteFood.foodItem} has the highest recorded waste`,
        description: `${formatNumber(
          highestWasteFood.wasted,
        )} ${activeUnit} wasted across its recorded entries. Consider reviewing preparation quantities and demand patterns.`,
        type: "warning",
      });
    }

    if (wastePercentage > wasteTarget) {
      results.push({
        title: "Waste rate needs attention",
        description: `The recorded waste rate is ${formatNumber(
          wastePercentage,
        )}%, above your target of ${formatNumber(
          wasteTarget,
        )}%, above your target of ${formatNumber(
          wasteTarget,
        )}%. Review preparation levels and compare them with actual demand.`,
        type: "warning",
      });
    } else if (wastePercentage > 0) {
      results.push({
        title: "Review opportunities to reduce waste",
        description: `The current recorded waste rate is ${formatNumber(
          wastePercentage,
        )}%, at or below your target of ${formatNumber(
          wasteTarget
        )}%. Track trends over time to identify where preparation can be improved.`,
        type: "info",
      });
    } else {
      results.push({
        title: "No waste recorded",
        description:
          "Your current records show no waste. Continue recording all preparation and consumption accurately.",
        type: "success",
      });
    }

    return results;
  }, [filteredRecords, highestWasteFood, wastePercentage, wasteTarget, activeUnit]);

  return (
    <section className="waste-analytics-page">
      <div className="waste-analytics-heading">
        <div>
          <span className="eyebrow">ANALYTICS / SUSTAINABILITY</span>
          <h1>Waste Analytics</h1>
          <p>
            Understand recorded food waste, discover patterns, and make
            data-informed preparation decisions.
          </p>
        </div>

        <label className="waste-analytics-period">
          <CalendarDays size={17} />
          <span>Measurement unit</span>
          <select
            value={activeUnit}
            onChange={(event) => setSelectedUnit(event.target.value)}
            disabled={!units.length}
            aria-label="Filter waste analytics by measurement unit"
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="waste-analytics-note">
        <Leaf size={20} />
        <div>
          <strong>Insights from your consumption records</strong>
          <p>
            These charts use records stored in the FoodWise database. All quantities are grouped
            by food item or date, for the selected {activeUnit || "measurement"}
            unit. Choose a unit above to avoid mixing quantities.
          </p>
        </div>
      </div>

      <div className="waste-analytics-kpis">
        <article className="waste-kpi-card">
          <div className="waste-kpi-icon prepared">
            <Utensils size={21} />
          </div>
          <span>Total Prepared</span>
          <strong>{formatNumber(totals.prepared)}</strong>
          <small>Sum of recorded quantities</small>
        </article>

        <article className="waste-kpi-card">
          <div className="waste-kpi-icon consumed">
            <Activity size={21} />
          </div>
          <span>Total Consumed</span>
          <strong>{formatNumber(totals.consumed)}</strong>
          <small>Sum of consumed quantities</small>
        </article>

        <article className="waste-kpi-card">
          <div className="waste-kpi-icon wasted">
            <Recycle size={21} />
          </div>
          <span>Total Wasted</span>
          <strong>{formatNumber(totals.wasted)}</strong>
          <small>Prepared minus consumed</small>
        </article>

        <article className="waste-kpi-card">
          <div className="waste-kpi-icon rate">
            <TrendingDown size={21} />
          </div>
          <span>Waste Rate</span>
          <strong>{formatNumber(wastePercentage)}%</strong>
          <small>
            Target: {formatNumber(wasteTarget)}% ·{" "}
            {targetStatus === "no-data"
              ? "No data"
              : targetStatus === "above"
                ? "Above target"
                : targetStatus === "at"
                  ? "At target"
                  : "Within target"}
          </small>
        </article>
      </div>

      <div className="waste-analytics-chart-grid">
        <article className="waste-chart-card">
          <div className="waste-chart-heading">
            <div>
              <h2>Daily Food Waste</h2>
              <p>Recorded waste for up to the last 7 dates</p>
            </div>
            <ChartColumnIncreasing size={21} />
          </div>

          {loading ? (
            <EmptyChart message="Loading consumption records..." />
          ) : dailyWaste.length > 0 ? (
            <div className="waste-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyWaste}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [
                      `${formatNumber(value)} (recorded unit)`,
                      "Waste",
                    ]}
                  />
                  <Bar
                    dataKey="wasted"
                    name="Food Wasted"
                    fill="#e58b45"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Add consumption records to see daily waste trends." />
          )}
        </article>

        <article className="waste-chart-card">
          <div className="waste-chart-heading">
            <div>
              <h2>Consumed vs Wasted</h2>
              <p>Distribution across recorded quantities</p>
            </div>
            <Recycle size={21} />
          </div>

          {pieData.length > 0 ? (
            <div className="waste-chart waste-pie-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={4}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={index === 0 ? "#299764" : "#e58b45"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `${formatNumber(value)} (recorded unit)`,
                      "Quantity",
                    ]}
                  />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Your consumption distribution will appear here." />
          )}
        </article>
      </div>

      <article className="waste-chart-card waste-food-breakdown">
        <div className="waste-chart-heading">
          <div>
            <h2>Waste by Food Item</h2>
            <p>Food items ranked by their recorded waste quantities</p>
          </div>
          <Recycle size={21} />
        </div>

        {wasteByFood.length > 0 ? (
          <div className="waste-food-list">
            {wasteByFood.map((item) => {
              const percentage =
                item.prepared > 0 ? (item.wasted / item.prepared) * 100 : 0;

              return (
                <div className="waste-food-row" key={item.foodItem}>
                  <div className="waste-food-row-heading">
                    <strong>{item.foodItem}</strong>
                    <span>
                      {formatNumber(item.wasted)}{" "}
                      {activeUnit} wasted
                    </span>
                  </div>

                  <div
                    className="waste-progress-track"
                    role="progressbar"
                    aria-label={`${item.foodItem} waste share of preparation`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(percentage, 100)}
                  >
                    <div
                      className="waste-progress-fill"
                      style={{
                        width: `${Math.min(Math.max(percentage, 0), 100)}%`,
                      }}
                    />
                  </div>

                  <small>
                    {formatNumber(percentage)}% of prepared quantity recorded
                    as waste
                  </small>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyChart message="Food-item breakdown will appear after records are added." />
        )}
      </article>

      <article className="waste-insights-card">
        <div className="waste-chart-heading">
          <div>
            <h2>Waste Insights & Recommendations</h2>
            <p>Rule-based suggestions generated from recorded data</p>
          </div>
          <AlertTriangle size={21} />
        </div>

        <div className="waste-insights-list">
          {insights.map((insight, index) => (
            <div
              className={`waste-insight-item ${insight.type}`}
              key={`${insight.title}-${index}`}
            >
              <div className="waste-insight-icon">
                {insight.type === "success" ? (
                  <Leaf size={19} />
                ) : (
                  <AlertTriangle size={19} />
                )}
              </div>
              <div>
                <strong>{insight.title}</strong>
                <p>{insight.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="waste-insights-disclaimer">
          These are preliminary, rule-based suggestions—not machine-learning
          predictions. Forecast-based recommendations can be added when the
          demand forecasting module is implemented.
        </p>
      </article>
    </section>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="waste-chart-empty">
      <ChartColumnIncreasing size={32} />
      <p>{message}</p>
    </div>
  );
}
