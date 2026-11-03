import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import api from "../api";
import useConsumptionRecords from "../hooks/useConsumptionRecords";

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const emptyForm = {
  foodItem: "Rice",
  date: today(),
  prepared: "",
  consumed: "",
  unit: "kg",
  notes: "",
};

function formatNumber(value) {
  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

export default function ConsumptionTracking() {
  const { records, setRecords, loading, error } = useConsumptionRecords();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    api.get("/api/food-items")
      .then((response) => {
        if (active) setInventoryItems(response.data.items);
      })
      .catch((requestError) => {
        console.error("Unable to load inventory food options:", requestError);
        if (active) {
          setNotice("Inventory food options could not be loaded. You can still enter any food name.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        record.foodItem.toLowerCase().includes(search.toLowerCase()) ||
        (record.notes || "").toLowerCase().includes(search.toLowerCase());

      const matchesDate = !dateFilter || record.date === dateFilter;

      return matchesSearch && matchesDate;
    });
  }, [records, search, dateFilter]);

  const totals = useMemo(() => {
    const result = {};
    records.forEach((record) => {
      const unit = record.unit || "units";
      result[unit] ||= { prepared: 0, consumed: 0, wasted: 0 };
      result[unit].prepared += Number(record.prepared) || 0;
      result[unit].consumed += Number(record.consumed) || 0;
      result[unit].wasted += Number(record.wasted) || 0;
    });
    return result;
  }, [records]);

  const wastePercentages = Object.entries(totals).map(([unit, values]) => ({
    unit,
    percentage: values.prepared > 0
      ? (values.wasted / values.prepared) * 100
      : 0,
  }));
  const foodOptions = [...new Set([
    ...inventoryItems.map((item) => item.name),
    ...records.map((record) => record.foodItem),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const prepared = Number(form.prepared);
    const consumed = Number(form.consumed);

    if (!form.foodItem || !form.date) {
      setNotice("Please select a food item and date.");
      return;
    }

    if (
      form.prepared === "" ||
      form.consumed === "" ||
      !Number.isFinite(prepared) ||
      !Number.isFinite(consumed) ||
      prepared <= 0 ||
      consumed < 0
    ) {
      setNotice("Enter a valid prepared quantity and consumed quantity.");
      return;
    }

    if (consumed > prepared) {
      setNotice("Consumed quantity cannot exceed prepared quantity.");
      return;
    }

    try {
      const payload = {
        foodItem: form.foodItem,
        date: form.date,
        prepared,
        consumed,
        wasted: prepared - consumed,
        unit: form.unit,
        notes: form.notes.trim(),
      };
      const response = editingId === null
        ? await api.post("/api/consumption", payload)
        : await api.put(`/api/consumption/${editingId}`, payload);

      setRecords((previous) => editingId === null
        ? [response.data.record, ...previous]
        : previous.map((record) => record.id === editingId
          ? response.data.record
          : record));

      setForm({ ...emptyForm, date: today() });
      setShowForm(false);
      setEditingId(null);
      setNotice(editingId === null
        ? "Consumption record saved successfully."
        : "Consumption record updated successfully.");
    } catch (error) {
      console.error(
        "Unable to save consumption record:",
        error.response?.data || error.message
      );

      setNotice(
        error.response?.data?.message ||
        "Unable to save the record. Please check your backend connection."
      );
    }
  }

  function openEditForm(record) {
    setEditingId(record.id);
    setForm({
      foodItem: record.foodItem,
      date: record.date,
      prepared: String(record.prepared),
      consumed: String(record.consumed),
      unit: record.unit || "kg",
      notes: record.notes || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, date: today() });
  }

  async function deleteRecord(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this consumption record?",
    );

    if (!confirmed) return;

    try {
      await api.delete(`/api/consumption/${id}`);
      setRecords((previous) => previous.filter((record) => record.id !== id));
      setNotice("Consumption record deleted.");
    } catch (requestError) {
      console.error("Unable to delete consumption record:", requestError);
      setNotice(
        requestError.response?.data?.message ||
          "Unable to delete the record. Please try again."
      );
    }
  }

  return (
    <section className="consumption-page">
      <div className="consumption-heading">
        <div>
          <span className="eyebrow">OPERATIONS / TRACKING</span>
          <h1>Consumption & Waste</h1>
          <p>
            Record daily food preparation, track consumption, and measure
            leftover food.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowForm(true)}
        >
          <Plus size={18} />
          Add Record
        </button>
      </div>

      {notice && (
        <div className="consumption-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="consumption-notice" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="consumption-summary-grid">
        <article className="consumption-summary-card">
          <div className="consumption-summary-icon prepared-icon">
            <Utensils size={20} />
          </div>
          <span>Total Prepared</span>
          <strong>{Object.entries(totals).map(([unit, values]) =>
            `${formatNumber(values.prepared)} ${unit}`).join(" · ") || "0"}</strong>
          <small>Across all recorded entries</small>
        </article>

        <article className="consumption-summary-card">
          <div className="consumption-summary-icon consumed-icon">
            <Activity size={20} />
          </div>
          <span>Total Consumed</span>
          <strong>{Object.entries(totals).map(([unit, values]) =>
            `${formatNumber(values.consumed)} ${unit}`).join(" · ") || "0"}</strong>
          <small>Food reported as consumed</small>
        </article>

        <article className="consumption-summary-card">
          <div className="consumption-summary-icon wasted-icon">
            <ClipboardList size={20} />
          </div>
          <span>Total Wasted</span>
          <strong>{Object.entries(totals).map(([unit, values]) =>
            `${formatNumber(values.wasted)} ${unit}`).join(" · ") || "0"}</strong>
          <small>Prepared minus consumed</small>
        </article>

        <article className="consumption-summary-card">
          <div className="consumption-summary-icon rate-icon">
            <CalendarDays size={20} />
          </div>
          <span>Waste Rate</span>
          <strong>{wastePercentages.length
            ? wastePercentages.map(({ unit, percentage }) =>
              `${formatNumber(percentage)}% ${unit}`).join(" · ")
            : "0%"}</strong>
          <small>Waste as a share of preparation</small>
        </article>
      </div>

      <div className="consumption-info-banner">
        <div>
          <strong>How is waste calculated?</strong>
          <p>
            Waste = Prepared quantity − Consumed quantity. These figures are
            based on the records entered by your team.
          </p>
        </div>
      </div>

      <div className="consumption-table-panel">
        <div className="consumption-table-heading">
          <div>
            <h2>Consumption Records</h2>
            <p>{filteredRecords.length} records displayed</p>
          </div>
        </div>

        <div className="consumption-filters">
          <label className="consumption-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search food items or notes..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="consumption-date-filter">
            <CalendarDays size={17} />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filter records by date"
            />
          </label>

          {(search || dateFilter) && (
            <button
              type="button"
              className="consumption-clear-button"
              onClick={() => {
                setSearch("");
                setDateFilter("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="consumption-table-scroll">
          <table className="consumption-table">
            <thead>
              <tr>
                <th>Food Item</th>
                <th>Date</th>
                <th>Prepared</th>
                <th>Consumed</th>
                <th>Wasted</th>
                <th>Waste Rate</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8">Loading consumption records...</td>
                </tr>
              )}
              {filteredRecords.map((record) => {
                const rate =
                  record.prepared > 0
                    ? (record.wasted / record.prepared) * 100
                    : 0;

                return (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.foodItem}</strong>
                    </td>
                    <td>
                      {new Date(`${record.date}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </td>
                    <td>
                      {formatNumber(record.prepared)} {record.unit}
                    </td>
                    <td>
                      {formatNumber(record.consumed)} {record.unit}
                    </td>
                    <td>
                      <span
                        className={`consumption-waste-value ${
                          record.wasted > 0 ? "has-waste" : "zero-waste"
                        }`}
                      >
                        {formatNumber(record.wasted)} {record.unit}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`consumption-rate-badge ${
                          rate >= 20
                            ? "rate-high"
                            : rate >= 10
                              ? "rate-medium"
                              : "rate-low"
                        }`}
                      >
                        {formatNumber(rate)}%
                      </span>
                    </td>
                    <td className="consumption-notes-cell">
                      {record.notes || "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="consumption-delete-button"
                        aria-label={`Edit ${record.foodItem} record`}
                        title="Edit record"
                        onClick={() => openEditForm(record)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="consumption-delete-button"
                        aria-label={`Delete ${record.foodItem} record`}
                        title="Delete record"
                        onClick={() => deleteRecord(record.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="8">
                    <div className="consumption-empty-state">
                      <ClipboardList size={32} />
                      <strong>No consumption records found</strong>
                      <p>
                        Add your first record or adjust your search filters.
                      </p>
                      {!search && !dateFilter && (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => setShowForm(true)}
                        >
                          <Plus size={17} />
                          Add First Record
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div
          className="consumption-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div
            className="consumption-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consumption-form-title"
          >
            <div className="consumption-modal-heading">
              <div>
                <span className="eyebrow">DAILY OPERATIONS</span>
                <h2 id="consumption-form-title">
                  {editingId === null ? "Add Consumption Record" : "Edit Consumption Record"}
                </h2>
                <p>Enter the quantities for one food item.</p>
              </div>

              <button
                type="button"
                className="consumption-modal-close"
                aria-label="Close form"
                onClick={closeForm}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="consumption-form-grid">
                <label className="consumption-field">
                  <span>Food Item *</span>
                  <input
                    name="foodItem"
                    value={form.foodItem}
                    onChange={updateForm}
                    list="consumption-food-options"
                    maxLength={120}
                    required
                  />
                  <datalist id="consumption-food-options">
                    {foodOptions.map((food) => (
                      <option key={food} value={food}>
                      </option>
                    ))}
                  </datalist>
                </label>

                <label className="consumption-field">
                  <span>Record Date *</span>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={updateForm}
                    max={today()}
                    required
                  />
                </label>

                <label className="consumption-field">
                  <span>Prepared Quantity *</span>
                  <input
                    type="number"
                    name="prepared"
                    min="0.01"
                    step="any"
                    placeholder="e.g. 50"
                    value={form.prepared}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label className="consumption-field">
                  <span>Consumed Quantity *</span>
                  <input
                    type="number"
                    name="consumed"
                    min="0"
                    step="any"
                    placeholder="e.g. 42"
                    value={form.consumed}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label className="consumption-field">
                  <span>Unit *</span>
                  <select
                    name="unit"
                    value={form.unit}
                    onChange={updateForm}
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="litres">Litres</option>
                    <option value="pieces">Pieces</option>
                    <option value="portions">Portions</option>
                  </select>
                </label>

                <label className="consumption-field consumption-field-full">
                  <span>Notes (optional)</span>
                  <textarea
                    name="notes"
                    rows="3"
                    maxLength="300"
                    placeholder="e.g. Lunch service, approximately 100 students..."
                    value={form.notes}
                    onChange={updateForm}
                  />
                </label>
              </div>

              <div className="consumption-live-calculation">
                <span>Calculated food waste</span>
                <strong>
                  {form.prepared !== "" &&
                  form.consumed !== "" &&
                  Number(form.prepared) >= Number(form.consumed) &&
                  Number(form.prepared) > 0
                    ? `${formatNumber(
                        Number(form.prepared) - Number(form.consumed),
                      )} ${form.unit}`
                    : "Enter valid quantities"}
                </strong>
              </div>

              <div className="consumption-form-actions">
                <button
                  type="button"
                  className="consumption-cancel-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  <CheckCircle2 size={17} />
                  {editingId === null ? "Save Record" : "Update Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}