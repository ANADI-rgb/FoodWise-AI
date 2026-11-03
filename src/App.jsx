import { checkBackendHealth } from "./api";
import api from "./api";
import { lazy, Suspense, useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Upload,
  TrendingUp,
  Recycle,
  Lightbulb,
  FileBarChart,
  Settings as SettingsIcon,
  Menu,
  Search,
  Bell,
  Leaf,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBasket,
  Utensils,
  CheckCircle2,
  CalendarDays,
  Plus,
  Clock3,
  Sprout,
  X,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import "./App.css";
const FoodInventory = lazy(() => import("./components/FoodInventory"));
const ConsumptionTracking = lazy(
  () => import("./components/ConsumptionTracking")
);
const WasteAnalytics = lazy(() => import("./components/WasteAnalytics"));
const DemandForecasting = lazy(
  () => import("./components/DemandForecasting")
);
const AIRecommendations = lazy(
  () => import("./components/AIRecommendations")
);
const DataImport = lazy(() => import("./components/DataImport"));
const Reports = lazy(() => import("./components/Reports"));
const Settings = lazy(() => import("./components/Settings"));

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, section: "MAIN" },
  { label: "Food Inventory", icon: Package },
  { label: "Consumption Records", icon: ClipboardList },
  { label: "Data Import", icon: Upload },
  { label: "Demand Forecasting", icon: TrendingUp, section: "ANALYTICS" },
  { label: "Waste Analytics", icon: Recycle },
  { label: "AI Recommendations", icon: Lightbulb },
  { label: "Reports", icon: FileBarChart, section: "SYSTEM" },
  { label: "Settings", icon: SettingsIcon },
];

const stats = [
  {
  label: "Total Food Stock",
  value: "0",
  unit: "quantity units",
  change: "0 items",
  positive: true,
  icon: ShoppingBasket,
  color: "green",
  note: "Current inventory",
},
  {
    label: "Predicted Demand",
    value: "342",
    unit: "kg",
    change: "8.4%",
    positive: true,
    icon: TrendingUp,
    color: "blue",
    note: "vs. last week",
  },
  {
    label: "Food Waste",
    value: "86",
    unit: "kg",
    change: "14.2%",
    positive: false,
    icon: Recycle,
    color: "orange",
    note: "vs. last month",
  },
  {
    label: "Waste Reduction",
    value: "32.6",
    unit: "%",
    change: "6.8%",
    positive: true,
    icon: Sprout,
    color: "purple",
    note: "vs. last month",
  },
];

const SETTINGS_STORAGE_KEY = "foodwise_app_settings_v1";

function readDashboardWasteTarget() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!saved) return 10;

    const settings = JSON.parse(saved);
    const target = Number(settings.wasteTarget);

    if (!Number.isFinite(target)) return 10;

    return Math.min(100, Math.max(0, target));
  } catch (error) {
    console.error("Unable to read dashboard waste target:", error);
    return 10;
  }
}

function Sidebar({
  activePage,
  setActivePage,
  mobileOpen,
  setMobileOpen,
  backendStatus,
  organizationName,
  facilityType,
}) {
  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Leaf size={23} strokeWidth={2.5} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">FoodWise<span> AI</span></span>
            <span className="brand-caption">SMART FOOD MANAGEMENT</span>
          </div>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-card">
          <div className="workspace-avatar">
            <Sprout size={21} />
          </div>
          <div className="workspace-copy">
            <strong>{organizationName}</strong>
            <span>{facilityType}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label}>
                {item.section && (
                  <p className="nav-section">{item.section}</p>
                )}

                <button
                  className={`nav-item ${
                    activePage === item.label ? "nav-item-active" : ""
                  }`}
                  onClick={() => {
                    setActivePage(item.label);
                    setMobileOpen(false);
                  }}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="impact-card">
            <div className="impact-icon">
              <Leaf size={19} />
            </div>
            <span className="impact-label">FOODWISE WORKSPACE</span>
            <strong>Live <small>data</small></strong>
            <p>Inventory and consumption records stay in your database.</p>
          </div>

          <div className="sidebar-footer">
            <span className={`online-dot online-dot-${backendStatus}`} />
            <span>
              {backendStatus === "connected"
                ? "Backend connected"
                : backendStatus === "checking"
                  ? "Checking backend"
                  : "Backend unavailable"}
            </span>
            <span className="version">v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Header({ activePage, setMobileOpen, setActivePage }) {
  const [search, setSearch] = useState("");

  function handleSearchKeyDown(event) {
    if (event.key !== "Enter") return;
    const query = search.trim().toLowerCase();
    if (!query) return;

    const match = navigation.find((item) =>
      item.label.toLowerCase().includes(query)
    );

    if (match) {
      setActivePage(match.label);
      setSearch("");
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={22} />
        </button>

        <div className="breadcrumb">
          <span>Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <strong>{activePage}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="search-box" title="Type a page name and press Enter">
          <Search size={17} />
          <input
            aria-label="Search pages"
            placeholder="Search pages..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <kbd>↵</kbd>
        </label>

        <div
          className="icon-button notification-button"
          role="img"
          aria-label="Automated notifications are not enabled"
          title="Automated notifications are not enabled"
        >
          <Bell size={19} />
        </div>

        <div className="topbar-divider" />

        <button
          className="profile-button"
          type="button"
          onClick={() => setActivePage("Settings")}
          aria-label="Open settings"
        >
          <div className="profile-avatar">AR</div>
          <div className="profile-copy">
            <strong>Admin User</strong>
            <span>Administrator</span>
          </div>
        </button>
      </div>
    </header>
  );
}

function StatCard({ stat }) {
  const Icon = stat.icon;

  return (
    <article className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon stat-icon-${stat.color}`}>
          <Icon size={21} strokeWidth={1.9} />
        </div>

        <span className="stat-more" aria-hidden="true">···</span>
      </div>

      <p className="stat-label">{stat.label}</p>

      <div className="stat-value">
        {stat.value}
        <span>{stat.unit}</span>
      </div>

      <div className="stat-bottom">
        <span className={`change-pill ${stat.positive ? "change-good" : "change-bad"}`}>
          {stat.positive ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          )}
          {stat.change}
        </span>
        <span className="stat-note">{stat.note}</span>
      </div>
    </article>
  );
}

function DemandChart({ records }) {
  const [range, setRange] = useState("7 Days");

  const numberOfDays = Number.parseInt(range, 10);

  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - numberOfDays + 1);

  const recordsByDate = {};

  records.forEach((record) => {
    if (!record.date) return;

    const recordDate = new Date(`${record.date}T00:00:00`);

    if (
      Number.isNaN(recordDate.getTime()) ||
      recordDate < startDate ||
      recordDate > today
    ) {
      return;
    }

    const dateKey = record.date;

    if (!recordsByDate[dateKey]) {
      recordsByDate[dateKey] = 0;
    }

    recordsByDate[dateKey] += Number(record.consumed || 0);
  });

  const chartData = [];

  for (let i = 0; i < numberOfDays; i += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    const actual = recordsByDate[dateKey] || 0;

    chartData.push({
      day:
        numberOfDays === 7
          ? date.toLocaleDateString("en-IN", { weekday: "short" })
          : date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            }),
      actual,
    });
  }

  const recordedDays = chartData.filter((item) => item.actual > 0);

  const averageConsumption =
    recordedDays.length > 0
      ? recordedDays.reduce((total, item) => total + item.actual, 0) /
        recordedDays.length
      : 0;

  const completedChartData = chartData.map((item) => ({
    ...item,
    forecast: Number(averageConsumption.toFixed(2)),
  }));

  const hasConsumptionData = records.some(
    (record) => Number(record.consumed || 0) > 0
  );

  return (
    <section className="panel demand-panel">
      <div className="panel-heading">
        <div>
          <h2>Food Demand Overview</h2>
          <p>Compare recorded consumption with a historical-average estimate.</p>
        </div>

        <select
          className="select-control"
          aria-label="Chart time range"
          value={range}
          onChange={(event) => setRange(event.target.value)}
        >
          <option>7 Days</option>
          <option>30 Days</option>
          <option>90 Days</option>
        </select>
      </div>

      <div className="chart-legend">
        <span>
          <i className="legend-dot legend-actual" /> Actual Consumption
        </span>
        <span>
          <i className="legend-dot legend-forecast" /> Average Estimate
        </span>
      </div>

      <div className="demand-chart">
        {hasConsumptionData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={completedChartData}
              margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="actualGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#27845b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#27845b" stopOpacity={0.01} />
                </linearGradient>

                <linearGradient
                  id="forecastGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#85b8e8" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#85b8e8" stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#edf1ee"
                strokeDasharray="4 5"
                vertical={false}
              />

              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#87938b", fontSize: 12 }}
                dy={10}
                interval={numberOfDays === 90 ? 6 : numberOfDays === 30 ? 2 : 0}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#87938b", fontSize: 11 }}
                tickFormatter={(value) => value}
                domain={[0, (dataMax) => Math.max(10, Math.ceil(dataMax * 1.2))]}
              />

              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e7eee8",
                  boxShadow: "0 8px 30px rgba(25, 60, 40, 0.08)",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [
                  Number(value).toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  }),
                  name === "actual" ? "Actual consumption" : "Average estimate",
                ]}
              />

              <Area
                type="monotone"
                dataKey="actual"
                stroke="#27845b"
                strokeWidth={2.5}
                fill="url(#actualGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#27845b",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />

              <Area
                type="monotone"
                dataKey="forecast"
                stroke="#86b5e1"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                fill="url(#forecastGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "#86b5e1",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="forecast-empty-state">
            <p>No consumption data available for the chart yet.</p>
            <span>Add consumption records to view demand trends.</span>
          </div>
        )}
      </div>

      <div className="chart-summary">
        <div>
          <span className="summary-dot" />
          <span>Average recorded daily consumption</span>
          <strong>
            {averageConsumption.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>

        <span className="chart-summary-note">
          Historical-average estimate · Not a trained ML forecast
        </span>
      </div>
    </section>
  );
}

function CategoryChart({ inventoryItems }) {
  const categoryTotals = inventoryItems.reduce((totals, item) => {
    const category = item.category || "Other";
    const quantity = Number(item.quantity) || 0;

    totals[category] = (totals[category] || 0) + quantity;

    return totals;
  }, {});

  const colors = [
    "#299764",
    "#72b58b",
    "#e5a45b",
    "#6998d0",
    "#a18bd1",
    "#d77f7f",
    "#94a3b8",
  ];

  const totalStock = Object.values(categoryTotals).reduce(
    (total, quantity) => total + quantity,
    0
  );

  const categoryData = Object.entries(categoryTotals).map(
    ([name, quantity], index) => ({
      name,
      quantity,
      value:
        totalStock > 0
          ? Number(((quantity / totalStock) * 100).toFixed(1))
          : 0,
      color: colors[index % colors.length],
    })
  );

  return (
    <section className="panel category-panel">
      <div className="panel-heading">
        <div>
          <h2>Food Distribution</h2>
          <p>Stock distribution by category.</p>
        </div>

        <span
          className="icon-button panel-menu"
          aria-hidden="true"
        >
          <span>···</span>
        </span>
      </div>

      <div className="category-chart">
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="quantity"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={88}
                paddingAngle={4}
                stroke="none"
              >
                {categoryData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>

              <Tooltip
                formatter={(value, name) => [
                  `${Number(value).toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })} quantity units`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="forecast-empty-state">
            <p>No inventory data available yet.</p>
          </div>
        )}

        <div className="category-center">
          <span>Total stock</span>

          <strong>
            {totalStock.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>

          <small>quantity units</small>
        </div>
      </div>

      <div className="category-legend">
        {categoryData.map((item) => (
          <div className="category-legend-item" key={item.name}>
            <span className="category-name">
              <i style={{ background: item.color }} />
              {item.name}
            </span>

            <strong>{item.value}%</strong>
          </div>
        ))}

        {categoryData.length === 0 && (
          <p>Add food items to see category distribution.</p>
        )}
      </div>
    </section>
  );
}

function InventoryTable({ setActivePage, inventoryItems }) {
  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const recentItems = [...inventoryItems]
    .sort((a, b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;

      return a.expiryDate.localeCompare(b.expiryDate);
    })
    .slice(0, 4);

  function getExpiryInfo(expiryDate) {
    if (!expiryDate) {
      return {
        label: "Not set",
        className: "",
        status: "Unknown",
        statusType: "warning",
      };
    }

    const expiry = new Date(`${expiryDate}T00:00:00`);
    const difference = Math.ceil(
      (expiry.getTime() - today.getTime()) / 86400000
    );

    if (Number.isNaN(expiry.getTime())) {
      return {
        label: "Invalid date",
        className: "",
        status: "Unknown",
        statusType: "warning",
      };
    }

    if (difference < 0) {
      return {
        label: "Expired",
        className: "expiry-critical",
        status: "Expired",
        statusType: "critical",
      };
    }

    if (difference === 0) {
      return {
        label: "Today",
        className: "expiry-critical",
        status: "Expires Today",
        statusType: "critical",
      };
    }

    if (difference <= 2) {
      return {
        label: `${difference} ${difference === 1 ? "day" : "days"}`,
        className: "expiry-critical",
        status: "Expiring Soon",
        statusType: "critical",
      };
    }

    if (difference <= 5) {
      return {
        label: `${difference} days`,
        className: "",
        status: "Expiring Soon",
        statusType: "warning",
      };
    }

    return {
      label: `${difference} days`,
      className: "",
      status: "In Stock",
      statusType: "healthy",
    };
  }

  return (
    <section className="panel inventory-panel">
      <div className="panel-heading">
        <div>
          <h2>Recent Food Inventory</h2>
          <p>Keep track of stock levels and expiration dates.</p>
        </div>

        <button
          className="text-button"
          onClick={() => setActivePage("Food Inventory")}
        >
          View all <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="table-wrapper">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>FOOD ITEM</th>
              <th>CATEGORY</th>
              <th>QUANTITY</th>
              <th>EXPIRY IN</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            {recentItems.length > 0 ? (
              recentItems.map((item) => {
                const expiryInfo = getExpiryInfo(item.expiryDate);

                const categoryClass = String(
                  item.category || "other"
                )
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-");

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="food-name">
                        <div
                          className={`food-item-icon food-${categoryClass}`}
                        >
                          <Utensils size={16} />
                        </div>

                        <strong>{item.name}</strong>
                      </div>
                    </td>

                    <td>{item.category || "Other"}</td>

                    <td className="quantity-cell">
                      {Number(item.quantity || 0).toLocaleString(
                        "en-IN",
                        { maximumFractionDigits: 2 }
                      )}{" "}
                      {item.unit || "units"}
                    </td>

                    <td>
                      <span className={expiryInfo.className}>
                        {expiryInfo.label}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge status-${expiryInfo.statusType}`}
                      >
                        <span />
                        {expiryInfo.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  No food items found. Add items to your inventory
                  to see them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          Showing {recentItems.length} of {inventoryItems.length} food items
        </span>

        <button onClick={() => setActivePage("Food Inventory")}>
          Manage inventory <ArrowUpRight size={14} />
        </button>
      </div>
    </section>
  );
}

function ActivityPanel({ inventoryItems, consumptionRecords }) {
  const activities = [];

  const latestConsumption = [...consumptionRecords]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 3);

  latestConsumption.forEach((record) => {
    activities.push({
      icon: CheckCircle2,
      color: "activity-green",
      title: "Consumption record saved",
      description: `${record.foodItem || "Food item"}: ${Number(
        record.consumed || 0
      )} ${record.unit || "units"} consumed`,
      time: record.createdAt
        ? new Date(record.createdAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : record.date || "Date not available",
      sortDate: new Date(record.createdAt || record.date || 0).getTime(),
    });
  });

  const latestInventory = [...inventoryItems]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 2);

  latestInventory.forEach((item) => {
    activities.push({
      icon: Recycle,
      color: "activity-purple",
      title: "Inventory item",
      description: `${item.name || "Food item"} — ${Number(
        item.quantity || 0
      )} ${item.unit || "units"} currently recorded`,
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "Current inventory",
      sortDate: new Date(item.createdAt || 0).getTime(),
    });
  });

  activities.sort((a, b) => b.sortDate - a.sortDate);

  const visibleActivities = activities.slice(0, 5);

  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Recent Activity</h2>
          <p>Recent entries from your workspace data.</p>
        </div>
        <Clock3 size={18} className="muted-icon" />
      </div>

      <div className="activity-list">
        {visibleActivities.length > 0 ? (
          visibleActivities.map((activity, index) => {
            const Icon = activity.icon;

            return (
              <div
                className="activity-item"
                key={`${activity.title}-${index}`}
              >
                <div className={`activity-icon ${activity.color}`}>
                  <Icon size={17} />
                </div>

                <div className="activity-content">
                  <strong>{activity.title}</strong>
                  <p>{activity.description}</p>
                  <span>{activity.time}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="forecast-empty-state">
            <p>No activity data available yet.</p>
            <span>Add inventory items or consumption records to see entries here.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendationCard({
  setActivePage,
  inventoryItems,
  consumptionRecords,
}) {
  const [wasteAlerts] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"
      ).wasteAlerts !== false;
    } catch (error) {
      console.error("Unable to read waste alert preference:", error);
      return true;
    }
  });

  const [today] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const expiringItems = inventoryItems
    .filter((item) => item.expiryDate)
    .map((item) => {
      const expiryDate = new Date(`${item.expiryDate}T00:00:00`);
      const daysRemaining = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / 86400000
      );

      return { ...item, daysRemaining };
    })
    .filter(
      (item) =>
        Number.isFinite(item.daysRemaining) &&
        item.daysRemaining <= 3
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const totalWaste = consumptionRecords.reduce(
    (total, record) => total + Math.max(0, Number(record.wasted) || 0),
    0
  );

  let title = "Keep your inventory up to date";
  let description =
    "Add food items and record daily consumption to receive recommendations based on your food inventory and waste data.";
  let buttonLabel = "Review inventory";
  let targetPage = "Food Inventory";

  if (expiringItems.length > 0) {
    const urgentItems = expiringItems.slice(0, 3);
    const itemNames = urgentItems.map((item) => item.name).join(", ");

    const expiredCount = expiringItems.filter(
      (item) => item.daysRemaining < 0
    ).length;

    const expiresTodayCount = expiringItems.filter(
      (item) => item.daysRemaining === 0
    ).length;

    title =
      expiredCount > 0
        ? "Review expired inventory items"
        : expiresTodayCount > 0
          ? "Prioritize items expiring today"
          : "Plan meals around upcoming expiry dates";

    description = `${itemNames}${expiringItems.length > 3 ? " and other items" : ""} ${
      expiredCount > 0
        ? "may already be expired. Check their condition and follow your food-safety procedures before deciding whether they can be used."
        : "should be reviewed and considered for upcoming meals where appropriate."
    }`;

    buttonLabel = "Review inventory";
    targetPage = "Food Inventory";
  } else if (wasteAlerts && consumptionRecords.length > 0 && totalWaste > 0) {
    title = "Review recorded food waste";
    description = `Your consumption records contain ${totalWaste.toLocaleString(
      "en-IN",
      { maximumFractionDigits: 2 }
    )} recorded quantity units of waste. Review the waste analytics to identify patterns and plan preparation quantities more carefully.`;

    buttonLabel = "View waste analytics";
    targetPage = "Waste Analytics";
  } else if (inventoryItems.length > 0) {
    title = "Inventory recorded successfully";
    description =
      "No items with expiry dates in the next three days were found. Continue recording consumption and waste to identify useful trends.";
    buttonLabel = "Review consumption";
    targetPage = "Consumption Tracking";
  }

  function handleReview() {
    if (typeof setActivePage === "function") {
      setActivePage(targetPage);
    }
  }

  return (
    <section className="recommendation-card">
      <div className="recommendation-icon">
        <Lightbulb size={22} />
      </div>

      <div className="recommendation-content">
        <span className="recommendation-eyebrow">SMART INSIGHT</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className="recommendation-action"
        onClick={handleReview}
      >
        {buttonLabel} <ArrowUpRight size={16} />
      </button>
    </section>
  );
}

function Dashboard({ setActivePage }) {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [consumptionRecords, setConsumptionRecords] = useState([]);
  const [dashboardError, setDashboardError] = useState("");
  const [wasteTarget] = useState(
    readDashboardWasteTarget
  );
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [inventoryResponse, consumptionResponse] = await Promise.all([
          api.get("/api/food-items"),
          api.get("/api/consumption"),
        ]);

        if (isMounted) {
          setInventoryItems(inventoryResponse.data.items);
          setConsumptionRecords(consumptionResponse.data.records);
        }
      } catch (error) {
        console.error("Unable to load dashboard data:", error);
        if (isMounted) {
          setDashboardError(
            error.response?.data?.message ||
              error.response?.data?.error ||
              "Dashboard data could not be loaded. Check that the backend is running."
          );
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalFoodItems = inventoryItems.length;

  const totalStockQuantity = inventoryItems.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  const totalFoodWaste = consumptionRecords.reduce(
    (total, record) => total + Number(record.wasted || 0),
    0
  );

  const totalFoodPrepared = consumptionRecords.reduce(
    (total, record) => total + Number(record.prepared || 0),
    0
  );

  const wasteRate =
    totalFoodPrepared > 0
      ? (totalFoodWaste / totalFoodPrepared) * 100
      : 0;

  const dailyDemandByFood = {};
  consumptionRecords.forEach((record) => {
    if (!record.date || !record.foodItem) return;

    if (!dailyDemandByFood[record.foodItem]) {
      dailyDemandByFood[record.foodItem] = {};
    }

    dailyDemandByFood[record.foodItem][record.date] =
      (dailyDemandByFood[record.foodItem][record.date] || 0) +
      Number(record.consumed || 0);
  });

  const predictedDemand = Object.values(dailyDemandByFood).reduce(
    (total, quantitiesByDate) => {
      const recentDays = Object.entries(quantitiesByDate)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .slice(0, 7)
        .map(([, quantity]) => quantity);

      const average =
        recentDays.reduce((sum, quantity) => sum + quantity, 0) /
        Math.max(1, recentDays.length);

      return total + average;
    },
    0
  );
  const hour = currentDate.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow"><Sprout size={15} /> YOUR SMART FOOD WORKSPACE</div>
          <h1>{greeting}, Admin <span>✳</span></h1>
          <p>Here's what's happening with your food resources today.</p>
        </div>

        {dashboardError && (
          <div className="forecast-empty-state" role="alert">
            {dashboardError}
          </div>
        )}

        <div className="welcome-actions">
          <div className="date-chip">
            <CalendarDays size={16} />
            <span>{currentDate.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}</span>
          </div>

          <button
            className="primary-button"
            onClick={() => setActivePage("Food Inventory")}
          >
            <Plus size={18} />
            Add Food Item
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => {
          const dashboardStat =
            stat.label === "Total Food Stock"
              ? {
                  ...stat,
                  value: totalStockQuantity.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  }),
                  unit: "quantity units",
                  change: `${totalFoodItems} items`,
                  positive: true,
                  note: "Current inventory",
                }
              : stat.label === "Food Waste"
                ? {
                    ...stat,
                    value: totalFoodWaste.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    }),
                    unit: "quantity units",
                    change: `${consumptionRecords.length} records`,
                    positive: false,
                    note: "Recorded food waste",
                  }

                : stat.label === "Predicted Demand"
                  ? {
                      ...stat,
                      value: predictedDemand.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      }),
                      unit: "quantity units",
                      change: `${Object.keys(dailyDemandByFood).length} food items`,
                      positive: true,
                      note: "Estimated average daily demand",
                    }
                : stat.label === "Waste Reduction"
                  ? {
                      ...stat,
                      label: "Food Waste Rate",
                      value: wasteRate.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      }),
                      unit: "%",
                      change: `${totalFoodPrepared.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })} prepared`,
                      positive: wasteRate <= wasteTarget,
                      note: `Target: ${wasteTarget}%`,
                    }
                  : stat;

          return <StatCard key={stat.label} stat={dashboardStat} />;
        })}
      </div>

      <div className="analytics-grid">
        <DemandChart records={consumptionRecords} />
        <CategoryChart inventoryItems={inventoryItems}/>
      </div>

      <div className="lower-grid">
        <InventoryTable setActivePage={setActivePage} inventoryItems={inventoryItems} />
        <ActivityPanel
          inventoryItems={inventoryItems}
          consumptionRecords={consumptionRecords}
        />
      </div>

      <RecommendationCard
        setActivePage={setActivePage}
        inventoryItems={inventoryItems}
        consumptionRecords={consumptionRecords}
      />

      <footer className="dashboard-footer">
        <span>© 2026 FoodWise AI</span>
        <span>Designed for a more sustainable future <Leaf size={13} /></span>
        <span>Data reflects records stored in the FoodWise database</span>
      </footer>
    </>
  );
}

function PlaceholderPage({ activePage, setActivePage }) {
  const pageInfo = {
    "Food Inventory": {
      icon: Package,
      title: "Food Inventory",
      description: "Track food stock, quantities, categories and expiration dates.",
      action: "Add Food Item",
    },
    "Consumption Records": {
      icon: ClipboardList,
      title: "Consumption Records",
      description: "Record daily food usage and understand consumption patterns.",
      action: "Add Consumption Record",
    },
    "Data Import": {
      icon: Upload,
      title: "Import Your Data",
      description: "Prepare to import food inventory and consumption records.",
      action: "Choose File",
    },
    "Demand Forecasting": {
      icon: TrendingUp,
      title: "Demand Forecasting",
      description: "Explore predicted food demand and consumption trends.",
      action: "Generate Forecast",
    },
    "Waste Analytics": {
      icon: Recycle,
      title: "Waste Analytics",
      description: "Monitor food waste and identify opportunities to reduce it.",
      action: "View Analysis",
    },
    "AI Recommendations": {
      icon: Lightbulb,
      title: "AI Recommendations",
      description: "Discover data-driven suggestions for smarter food management.",
      action: "Explore Recommendations",
    },
    Reports: {
      icon: FileBarChart,
      title: "Reports",
      description: "Review food demand, inventory and waste management reports.",
      action: "Generate Report",
    },
    Settings: {
      icon: Settings,
      title: "Settings",
      description: "Manage your workspace preferences and account settings.",
      action: "Save Settings",
    },
  };

  const info = pageInfo[activePage] || pageInfo["Food Inventory"];
  const Icon = info.icon;

  return (
    <div className="placeholder-page">
      <div className="eyebrow"><Sprout size={15} /> FOODWISE AI WORKSPACE</div>
      <div className="placeholder-icon"><Icon size={32} /></div>
      <h1>{info.title}</h1>
      <p>{info.description}</p>

      <div className="placeholder-notice">
        <div className="placeholder-notice-icon"><Lightbulb size={20} /></div>
        <div>
          <strong>This page is being built</strong>
          <p>
            The dashboard foundation is ready. We'll implement this page's
            forms, tables and functionality in the next development steps.
          </p>
        </div>
      </div>

      <button
        className="primary-button"
        onClick={() => setActivePage("Dashboard")}
      >
        <LayoutDashboard size={17} />
        Return to Dashboard
      </button>
    </div>
  );
}

function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [activePage, setActivePage] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("My Organization");
  const [facilityType, setFacilityType] = useState("Food Management");

  useEffect(() => {
    function syncSettings() {
      try {
        const settings = JSON.parse(
          localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"
        );
        setOrganizationName(
          typeof settings.organizationName === "string" &&
            settings.organizationName.trim()
            ? settings.organizationName.trim()
            : "My Organization"
        );
        setFacilityType(
          typeof settings.facilityType === "string" && settings.facilityType
            ? settings.facilityType
            : "Food Management"
        );
        document.documentElement.dataset.theme =
          settings.theme === "dark" ? "dark" : "light";
      } catch (error) {
        console.error("Unable to apply saved workspace settings:", error);
        document.documentElement.dataset.theme = "light";
      }
    }

    syncSettings();
    window.addEventListener("foodwise-settings-changed", syncSettings);
    return () =>
      window.removeEventListener("foodwise-settings-changed", syncSettings);
  }, []);

  useEffect(() => {
    let active = true;
    checkBackendHealth()
      .then(() => {
        if (active) setBackendStatus("connected");
      })
      .catch((error) => {
        console.error("Backend connection failed:", error);
        if (active) setBackendStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        backendStatus={backendStatus}
        organizationName={organizationName}
        facilityType={facilityType}
      />

      <main className="main-area">
        <Header
          activePage={activePage}
          setMobileOpen={setMobileOpen}
          setActivePage={setActivePage}
        />

        <div className="page-content">
          <Suspense fallback={<div className="page-loading">Loading page...</div>}>
            {activePage === "Dashboard" ? (
              <Dashboard setActivePage={setActivePage} />
            ) : activePage === "Food Inventory" ? (
              <FoodInventory />
            ) : activePage === "Consumption Records" ? (
              <ConsumptionTracking />
            ) : activePage === "Data Import" ? (
              <DataImport />
            ) : activePage === "Waste Analytics" ? (
              <WasteAnalytics />
            ) : activePage === "Demand Forecasting" ? (
              <DemandForecasting />
            ) : activePage === "AI Recommendations" ? (
              <AIRecommendations setActivePage={setActivePage} />
            ) : activePage === "Reports" ? (
              <Reports />
            ) : activePage === "Settings" ? (
              <Settings />
            ) : (
              <PlaceholderPage
                activePage={activePage}
                setActivePage={setActivePage}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
