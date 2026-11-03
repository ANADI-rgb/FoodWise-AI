import { useEffect, useMemo, useState } from "react";
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Utensils,
  RefreshCw,
  ClipboardList,
} from "lucide-react";

const SETTINGS_KEY = "foodwise_app_settings_v1";

import api from "../api";
import useConsumptionRecords from "../hooks/useConsumptionRecords";

function formatNumber(value) {
  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

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

function readSafetyBuffer() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const buffer = Number(JSON.parse(saved || "{}").safetyBuffer);
    return Number.isFinite(buffer) ? Math.min(100, Math.max(0, buffer)) : 10;
  } catch {
    return 10;
  }
}

function readWasteAlerts() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return JSON.parse(saved || "{}").wasteAlerts !== false;
  } catch {
    return true;
  }
}

function AIRecommendations({ setActivePage }) {
  const { records, loading, error, refresh } = useConsumptionRecords();
  const [wasteTarget, setWasteTarget] = useState(readWasteTarget);
  const [safetyBuffer, setSafetyBuffer] = useState(readSafetyBuffer);
  const [wasteAlerts, setWasteAlerts] = useState(readWasteAlerts);
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState("");
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

  useEffect(() => {
    let active = true;
    api.get("/api/food-items")
      .then((response) => {
        if (active) setInventory(response.data.items);
      })
      .catch((requestError) => {
        console.error("Unable to load inventory for recommendations:", requestError);
        if (active) {
          setInventoryError(
            requestError.response?.data?.error ||
              "Inventory-based recommendations are unavailable."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function refreshRecords() {
    refresh();
    setWasteTarget(readWasteTarget());
    setSafetyBuffer(readSafetyBuffer());
    setWasteAlerts(readWasteAlerts());
  }

  const analysis = useMemo(() => {
    const grouped = {};

    records.forEach((record) => {
      const foodName = record.foodItem?.trim();

      if (!foodName) return;

      const unit = record.unit || "units";
      const groupKey = `${foodName.toLowerCase()}::${unit.toLowerCase()}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          name: foodName,
          unit,
          prepared: 0,
          consumed: 0,
          wasted: 0,
          recordCount: 0,
          dailyConsumption: {},
        };
      }

      const item = grouped[groupKey];

      item.prepared += Number(record.prepared) || 0;
      item.consumed += Number(record.consumed) || 0;
      item.wasted += Number(record.wasted) || 0;
      item.recordCount += 1;

      if (record.date) {
        item.dailyConsumption[record.date] =
          (item.dailyConsumption[record.date] || 0) +
          (Number(record.consumed) || 0);
      }
    });

    const foodItems = Object.values(grouped).map((item) => ({
      ...item,
      units: [item.unit],
      wasteRate:
        item.prepared > 0
          ? (item.wasted / item.prepared) * 100
          : 0,
      averageDailyConsumption: (() => {
        const recentDays = Object.entries(item.dailyConsumption)
          .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
          .slice(0, 7)
          .map(([, quantity]) => quantity);
        return recentDays.length
          ? recentDays.reduce((sum, quantity) => sum + quantity, 0) /
              recentDays.length
          : 0;
      })(),
    }));

    const unitTotals = foodItems.reduce((totals, item) => {
      const unit = item.unit;
      totals[unit] ||= { prepared: 0, consumed: 0, wasted: 0 };
      totals[unit].prepared += item.prepared;
      totals[unit].consumed += item.consumed;
      totals[unit].wasted += item.wasted;
      return totals;
    }, {});
    const wasteRates = Object.entries(unitTotals).map(([unit, totals]) => ({
      unit,
      rate: totals.prepared > 0
        ? (totals.wasted / totals.prepared) * 100
        : 0,
    }));

    return {
      foodItems,
      unitTotals,
      wasteRates,
    };
  }, [records]);

  const recommendations = useMemo(() => {
    const results = [];

    if (analysis.foodItems.length === 0) {
      results.push({
          id: "no-data",
          priority: "Medium",
          title: "Start recording food consumption",
          description:
            "Add consumption records for your food items to generate useful, data-based recommendations.",
          action:
            "Open Consumption Records and add your first record.",
          icon: ClipboardList,
          targetPage: "Consumption Records",
      });
    }

    analysis.foodItems.forEach((item) => {
      const unit = item.units.length === 1 ? item.units[0] : "mixed units";
      const inventoryMatch = inventory.find(
        (stock) =>
          stock.name.trim().toLowerCase() === item.name.toLowerCase() &&
          stock.unit.toLowerCase() === unit.toLowerCase()
      );

      if (item.recordCount < 3) {
        results.push({
          id: `data-${item.name}-${unit}`,
          priority: "Medium",
          title: `Collect more data for ${item.name} (${unit})`,
          description:
            `Only ${item.recordCount} record(s) are available. More records across different dates will help make future demand estimates more reliable.`,
          action:
            "Record preparation and consumption regularly before making major changes.",
          icon: ClipboardList,
          targetPage: "Consumption Records",
        });
      }

      if (item.prepared <= 0) return;

      if (wasteAlerts && item.wasteRate >= 25) {
        results.push({
          id: `high-waste-${item.name}-${unit}`,
          priority: "High",
          title: `Investigate high waste for ${item.name}`,
          description:
            `${item.wasteRate.toFixed(1)}% of the recorded prepared quantity was wasted. Review portion sizes, attendance, demand patterns, and leftover handling.`,
          action:
            "Compare several days of records and adjust preparation gradually.",
          icon: AlertTriangle,
          targetPage: "Waste Analytics",
        });
      } else if (wasteAlerts && item.wasteRate >= 10) {
        results.push({
          id: `moderate-waste-${item.name}-${unit}`,
          priority: "Medium",
          title: `Reduce waste for ${item.name}`,
          description:
            `${item.wasteRate.toFixed(1)}% of the recorded prepared quantity was wasted. Small preparation adjustments may help reduce leftovers.`,
          action:
            "Compare planned quantities with actual consumption for the next few service days.",
          icon: TrendingDown,
          targetPage: "Waste Analytics",
        });
      } else if (item.wasteRate < 5 && item.recordCount >= 3) {
        results.push({
          id: `low-waste-${item.name}-${unit}`,
          priority: "Low",
          title: `Maintain the preparation plan for ${item.name}`,
          description:
            `Recorded waste is ${item.wasteRate.toFixed(1)}%. Continue monitoring demand to check whether this pattern remains consistent.`,
          action:
            "Keep tracking daily preparation and consumption.",
          icon: CheckCircle2,
          targetPage: "Demand Forecasting",
        });
      }

      if (
        unit !== "mixed units" &&
        item.averageDailyConsumption > 0 &&
        inventoryMatch &&
        inventoryMatch.quantity < item.averageDailyConsumption
      ) {
        results.push({
          id: `stock-${item.name}-${unit}`,
          priority: "High",
          title: `Review stock coverage for ${item.name}`,
          description:
            `${formatNumber(inventoryMatch.quantity)} ${unit} is on hand, below the recent recorded daily consumption average of ${formatNumber(item.averageDailyConsumption)} ${unit}.`,
          action:
            `Consider reviewing replenishment. The forecast safety buffer is ${safetyBuffer}%.`,
          icon: AlertTriangle,
          targetPage: "Food Inventory",
        });
      }
    });

    const expiringItems = inventory
      .filter((item) => item.expiryDate)
      .map((item) => {
        const expiry = new Date(`${item.expiryDate}T00:00:00`);
        return {
          ...item,
          daysRemaining: Math.ceil(
            (expiry.getTime() - today.getTime()) / 86400000
          ),
        };
      })
      .filter((item) =>
        Number.isFinite(item.daysRemaining) && item.daysRemaining <= 3
      );

    if (expiringItems.length) {
      const names = expiringItems.slice(0, 3).map((item) => item.name).join(", ");
      const expiredCount = expiringItems.filter(
        (item) => item.daysRemaining < 0
      ).length;
      results.push({
        id: "expiry-review",
        priority: expiredCount ? "High" : "Medium",
        title: expiredCount
          ? "Review expired inventory"
          : "Plan around upcoming expiry dates",
        description: `${names}${expiringItems.length > 3 ? " and other items" : ""} need an expiry-date review.`,
        action: "Check food condition and follow your food-safety procedures; do not rely on this alert to determine food safety.",
        icon: AlertTriangle,
        targetPage: "Food Inventory",
      });
    }

    (wasteAlerts ? analysis.wasteRates : [])
      .filter((entry) => entry.rate > wasteTarget)
      .forEach((entry) => {
        results.push({
          id: `overall-waste-${entry.unit}`,
          priority: "High",
          title: `Recorded waste is above target (${entry.unit})`,
          description:
            `The recorded waste rate for ${entry.unit} is ${entry.rate.toFixed(2)}%, above your target of ${wasteTarget}%. Review preparation quantities for the highest-waste foods measured in ${entry.unit}.`,
          action:
            "Compare preparation quantities with consumption for this unit before making adjustments.",
          icon: AlertTriangle,
          targetPage: "Waste Analytics",
        });
      });

    if (results.length === 0) {
      results.push({
        id: "monitor",
        priority: "Low",
        title: "Continue monitoring food consumption",
        description:
          "No major waste warning was triggered by the current rules. This does not guarantee that preparation quantities are optimal.",
        action:
          "Continue entering accurate records and review trends regularly.",
        icon: CheckCircle2,
        targetPage: "Demand Forecasting",
      });
    }

    const priorityOrder = {
      High: 0,
      Medium: 1,
      Low: 2,
    };

    return results.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }, [analysis, wasteTarget, safetyBuffer, inventory, today, wasteAlerts]);

  const priorityClass = (priority) =>
    priority.toLowerCase();

  return (
    <div className="recommendations-page">
      <div className="recommendations-header">
        <div>
          <h1>AI Recommendations</h1>
          <p>
            Practical suggestions from recorded consumption, inventory
            coverage, expiry dates, and your workspace targets.
          </p>
        </div>

        <button
          type="button"
          className="recommendations-refresh"
          onClick={refreshRecords}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh analysis
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
      {inventoryError && <p role="alert">{inventoryError}</p>}

      <div className="recommendations-summary">
        <div className="recommendation-summary-card">
          <span>Total prepared</span>
          <strong>{Object.entries(analysis.unitTotals).map(([unit, totals]) =>
            `${formatNumber(totals.prepared)} ${unit}`).join(" · ") || "0"}</strong>
          <small>Recorded quantities by unit</small>
        </div>

        <div className="recommendation-summary-card">
          <span>Total consumed</span>
          <strong>{Object.entries(analysis.unitTotals).map(([unit, totals]) =>
            `${formatNumber(totals.consumed)} ${unit}`).join(" · ") || "0"}</strong>
          <small>Recorded quantities by unit</small>
        </div>

        <div className="recommendation-summary-card">
          <span>Total wasted</span>
          <strong>{Object.entries(analysis.unitTotals).map(([unit, totals]) =>
            `${formatNumber(totals.wasted)} ${unit}`).join(" · ") || "0"}</strong>
          <small>Recorded quantities by unit</small>
        </div>

        <div className="recommendation-summary-card">
          <span>Waste rate</span>
          <strong>{analysis.wasteRates.map(({ unit, rate }) =>
            `${rate.toFixed(2)}% ${unit}`).join(" · ") || "0%"}</strong>
          <small>
            Target: {wasteTarget}% per unit
          </small>
        </div>
      </div>

      <div className="recommendations-section">
        <div className="recommendations-section-header">
          <div>
            <h2>
              <Lightbulb size={20} />
              Recommended actions
            </h2>
            <p>
              {recommendations.length} suggestion(s) generated from
              your current records.
            </p>
          </div>
        </div>

        <div className="recommendations-list">
          {recommendations.map((recommendation) => {
            const Icon = recommendation.icon;

            return (
              <article
                className="recommendation-card"
                key={recommendation.id}
              >
                <div
                  className={`recommendation-icon ${priorityClass(
                    recommendation.priority
                  )}`}
                >
                  <Icon size={21} />
                </div>

                <div className="recommendation-content">
                  <div className="recommendation-title-row">
                    <h3>{recommendation.title}</h3>

                    <span
                      className={`recommendation-priority ${priorityClass(
                        recommendation.priority
                      )}`}
                    >
                      {recommendation.priority} priority
                    </span>
                  </div>

                  <p>{recommendation.description}</p>

                  <div className="recommendation-action">
                    <strong>Suggested action:</strong>{" "}
                    {recommendation.action}
                    {recommendation.targetPage && (
                      <button
                        type="button"
                        onClick={() =>
                          setActivePage?.(recommendation.targetPage)
                        }
                      >
                        Open {recommendation.targetPage}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {analysis.foodItems.length > 0 && (
        <div className="recommendations-section">
          <div className="recommendations-section-header">
            <div>
              <h2>
                <Utensils size={20} />
                Food-wise waste review
              </h2>
              <p>
                Review each food item before changing preparation
                quantities.
              </p>
            </div>
          </div>

          <div className="recommendations-table-wrapper">
            <table className="recommendations-table">
              <thead>
                <tr>
                  <th>Food item</th>
                  <th>Records</th>
                  <th>Prepared</th>
                  <th>Consumed</th>
                  <th>Wasted</th>
                  <th>Waste rate</th>
                </tr>
              </thead>

              <tbody>
                {analysis.foodItems.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name} ({item.unit})</td>
                    <td>{item.recordCount}</td>
                    <td>{item.prepared.toFixed(1)}</td>
                    <td>{item.consumed.toFixed(1)}</td>
                    <td>{item.wasted.toFixed(1)}</td>
                    <td>
                      <span
                        className={`recommendation-priority ${
                          item.wasteRate >= 25
                            ? "high"
                            : item.wasteRate >= 10
                              ? "medium"
                              : "low"
                        }`}
                      >
                        {item.wasteRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      <div className="recommendations-disclaimer">
        <Lightbulb size={18} />

        <p>
          <strong>How recommendations work:</strong> This version
          uses transparent, rule-based analysis of your saved records.
          It does not yet use a trained AI model. Recommendations are
          guidance for managers, not guaranteed outcomes. Verify the
          data and local requirements before changing food
          preparation quantities.
        </p>
      </div>
    </div>
  );
}

export default AIRecommendations;