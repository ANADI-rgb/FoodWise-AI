import { useMemo, useState } from "react";
import {
  FileBarChart,
  Download,
  CalendarDays,
  Utensils,
  Package,
  Trash2,
  TrendingDown,
  FileSpreadsheet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import useConsumptionRecords from "../hooks/useConsumptionRecords";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function downloadCSV(filename, rows) {
  if (!rows.length) {
    alert("No records are available to export.");
    return;
  }

  const csvValue = (value) => {
    let text = String(value ?? "");
    if (/^[\t\r ]*[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  const { records, loading, error, refresh } = useConsumptionRecords();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedReport, setSelectedReport] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState("");

  const units = useMemo(() => [...new Set(
    records.map((record) => record.unit || "units")
  )].sort(), [records]);
  const activeUnit = units.includes(selectedUnit)
    ? selectedUnit
    : units[0] || "";

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (startDate && record.date < startDate) return false;
      if (endDate && record.date > endDate) return false;
      if (activeUnit && (record.unit || "units") !== activeUnit) return false;
      return true;
    });
  }, [records, startDate, endDate, activeUnit]);

  const summary = useMemo(() => {
    const prepared = filteredRecords.reduce(
      (total, record) => total + Number(record.prepared || 0),
      0
    );

    const consumed = filteredRecords.reduce(
      (total, record) => total + Number(record.consumed || 0),
      0
    );

    const wasted = filteredRecords.reduce(
      (total, record) => total + Number(record.wasted ?? (
        Number(record.prepared || 0) - Number(record.consumed || 0)
      )),
      0
    );

    return {
      totalRecords: filteredRecords.length,
      prepared,
      consumed,
      wasted,
      wasteRate: prepared > 0 ? (wasted / prepared) * 100 : 0,
    };
  }, [filteredRecords]);

  const foodBreakdown = useMemo(() => {
    const grouped = {};

    filteredRecords.forEach((record) => {
      const food = record.foodItem || "Unknown Food";

      if (!grouped[food]) {
        grouped[food] = {
          foodItem: food,
          prepared: 0,
          consumed: 0,
          wasted: 0,
          units: new Set(),
        };
      }

      grouped[food].prepared += Number(record.prepared || 0);
      grouped[food].consumed += Number(record.consumed || 0);
      grouped[food].wasted += Number(
        record.wasted ?? (
          Number(record.prepared || 0) - Number(record.consumed || 0)
        )
      );

      grouped[food].units.add(record.unit || "units");
    });

    return Object.values(grouped)
      .map((food) => ({
        ...food,
        units: [...food.units],
      }))
      .sort((a, b) => b.wasted - a.wasted);
  }, [filteredRecords]);

  const chartData = foodBreakdown.slice(0, 8).map((food) => ({
    foodItem: `${food.foodItem} (${food.units.join("/")})`,
    consumed: Number(food.consumed.toFixed(2)),
    wasted: Number(food.wasted.toFixed(2)),
  }));

  function exportDetailedReport() {
    const rows = [
      [
        "Food Item",
        "Date",
        "Prepared",
        "Consumed",
        "Wasted",
        "Unit",
        "Notes",
      ],
      ...filteredRecords.map((record) => [
        record.foodItem,
        record.date,
        record.prepared,
        record.consumed,
        record.wasted ?? (
          Number(record.prepared || 0) - Number(record.consumed || 0)
        ),
        record.unit,
        record.notes || "",
      ]),
    ];

    downloadCSV("foodwise-consumption-report.csv", rows);
  }

  function exportSummaryReport() {
    const rows = [
      ["FoodWise AI - Waste Summary Report"],
      ["Start Date", startDate || "All dates"],
      ["End Date", endDate || "All dates"],
      ["Unit", activeUnit || "All units"],
      [],
      ["Metric", "Value"],
      ["Consumption Records", summary.totalRecords],
      ["Prepared Quantity", summary.prepared],
      ["Consumed Quantity", summary.consumed],
      ["Wasted Quantity", summary.wasted],
      ["Waste Rate (%)", summary.wasteRate.toFixed(2)],
      [],
      ["Food Item", "Prepared", "Consumed", "Wasted", "Units"],
      ...foodBreakdown.map((food) => [
        food.foodItem,
        food.prepared,
        food.consumed,
        food.wasted,
        food.units.join(" / "),
      ]),
    ];

    downloadCSV("foodwise-waste-summary.csv", rows);
  }

  const exportSelectedReport = () => {
    if (selectedReport === "summary") {
      exportSummaryReport();
    } else {
      exportDetailedReport();
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Reports & Exports</h1>
          <p>
            Review consumption records and export food waste reports.
          </p>
        </div>

        <button
          className="reports-refresh-button"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh Data"}
        </button>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="reports-filters">
        <div className="reports-filter-field">
          <label htmlFor="report-start-date">
            <CalendarDays size={16} /> Start Date
          </label>
          <input
            id="report-start-date"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="reports-filter-field">
          <label htmlFor="report-end-date">
            <CalendarDays size={16} /> End Date
          </label>
          <input
            id="report-end-date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>

        <div className="reports-filter-field reports-export-field">
          <label htmlFor="report-type">Report Type</label>
          <select
            id="report-type"
            value={selectedReport}
            onChange={(event) => setSelectedReport(event.target.value)}
          >
            <option value="all">Detailed Consumption Report</option>
            <option value="summary">Waste Summary Report</option>
          </select>
        </div>

        <div className="reports-filter-field">
          <label htmlFor="report-unit">Measurement Unit</label>
          <select
            id="report-unit"
            value={activeUnit}
            onChange={(event) => setSelectedUnit(event.target.value)}
            disabled={!units.length}
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>

        <button
          className="reports-export-button"
          onClick={exportSelectedReport}
          disabled={loading || filteredRecords.length === 0}
        >
          <Download size={17} />
          Export CSV
        </button>
      </div>

      <div className="reports-kpi-grid">
        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-icon-green">
            <FileSpreadsheet size={21} />
          </div>
          <p>Total Records</p>
          <h2>{formatNumber(summary.totalRecords)}</h2>
          <span>Matching selected dates</span>
        </article>

        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-icon-blue">
            <Package size={21} />
          </div>
          <p>Total Prepared</p>
          <h2>{formatNumber(summary.prepared)}</h2>
          <span>{activeUnit || "Recorded quantity"}</span>
        </article>

        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-icon-purple">
            <Utensils size={21} />
          </div>
          <p>Total Consumed</p>
          <h2>{formatNumber(summary.consumed)}</h2>
          <span>{activeUnit || "Recorded quantity"}</span>
        </article>

        <article className="reports-kpi-card">
          <div className="reports-kpi-icon reports-icon-orange">
            <Trash2 size={21} />
          </div>
          <p>Total Wasted</p>
          <h2>{formatNumber(summary.wasted)}</h2>
          <span>
            Waste rate: {summary.wasteRate.toFixed(1)}%
          </span>
        </article>
      </div>

      <div className="reports-section">
        <div className="reports-section-heading">
          <div>
            <h2>Consumption vs Waste</h2>
            <p>Top food items by recorded waste quantity.</p>
          </div>
          <TrendingDown size={21} />
        </div>

        {chartData.length ? (
          <div className="reports-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 15, left: 0, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="foodItem"
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={55}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="consumed"
                  name="Consumed"
                  fill="#16a34a"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="wasted"
                  name="Wasted"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="reports-empty-state">
            <FileBarChart size={36} />
            <h3>No records found</h3>
            <p>
              Add consumption records or adjust the selected date range.
            </p>
          </div>
        )}
      </div>

      <div className="reports-section">
        <div className="reports-section-heading">
          <div>
            <h2>Food-wise Breakdown</h2>
            <p>
              Quantities are grouped by food name. Check the units column
              before comparing quantities.
            </p>
          </div>
        </div>

        {foodBreakdown.length ? (
          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Food Item</th>
                  <th>Prepared</th>
                  <th>Consumed</th>
                  <th>Wasted</th>
                  <th>Unit(s)</th>
                </tr>
              </thead>
              <tbody>
                {foodBreakdown.map((food) => (
                  <tr key={food.foodItem}>
                    <td>{food.foodItem}</td>
                    <td>{formatNumber(food.prepared)}</td>
                    <td>{formatNumber(food.consumed)}</td>
                    <td>{formatNumber(food.wasted)}</td>
                    <td>{food.units.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="reports-empty-message">
            No food records are available for this period.
          </p>
        )}
      </div>

      <p className="reports-disclaimer">
        Reports are generated from consumption records stored in the FoodWise
        database and filtered to {activeUnit || "the selected measurement unit"}.
      </p>
    </div>
  );
}