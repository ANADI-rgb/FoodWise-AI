import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import api from "../api";

const categories = [
  "Vegetables",
  "Fruits",
  "Grains",
  "Dairy",
  "Meat & Poultry",
  "Other",
];

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) {
    return { label: "Not specified", type: "neutral" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);

  if (Number.isNaN(expiry.getTime())) {
    return { label: "Invalid date", type: "neutral" };
  }

  const daysLeft = Math.round(
    (expiry.getTime() - today.getTime()) / 86400000
  );

  if (daysLeft < 0) {
    return { label: "Expired", type: "danger" };
  }

  if (daysLeft === 0) {
    return { label: "Expires today", type: "danger" };
  }

  if (daysLeft <= 3) {
    return {
      label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
      type: "warning",
    };
  }

  return {
    label: `${daysLeft} days left`,
    type: "success",
  };
}

const emptyForm = {
  name: "",
  category: "Vegetables",
  quantity: "",
  unit: "kg",
  expiryDate: addDays(7),
};

export default function FoodInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  
  useEffect(() => {
    let isMounted = true;

    async function loadInventory() {
      try {
        const response = await api.get("/api/food-items");

        if (isMounted) {
          setItems(response.data.items);
        }
      } catch (error) {
        console.error("Unable to load inventory from backend:", error);

        if (isMounted) {
          setNotice("Could not load inventory from the backend.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      isMounted = false;
    };
  }, []);


  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => setNotice(""), 3500);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesCategory =
        categoryFilter === "All" || item.category === categoryFilter;

      const expiry = getExpiryStatus(item.expiryDate);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Expiring" &&
          ["warning", "danger"].includes(expiry.type)) ||
        (statusFilter === "Fresh" && expiry.type === "success");

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  const expiringCount = items.filter((item) =>
    ["warning", "danger"].includes(getExpiryStatus(item.expiryDate).type)
  ).length;

  const totalQuantity = items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit,
      expiryDate: item.expiryDate || "",
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    const quantity = Number(form.quantity);

    if (!name) {
      setError("Please enter a food item name.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be a number greater than zero.");
      return;
    }

    if (!form.expiryDate) {
      setError("Please select an expiry date.");
      return;
    }

    if (!categories.includes(form.category)) {
      setError("Please select a valid category.");
      return;
    }

    const duplicate = items.some(
      (item) =>
        String(item.id) !== String(editingId) &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setError("An item with this name already exists.");
      return;
    }

    const payload = {
      name,
      category: form.category,
      quantity,
      unit: form.unit,
      expiryDate: form.expiryDate,
    };

    try {
      if (editingId !== null) {
        const response = await api.put(
          `/api/food-items/${editingId}`,
          payload
        );

        const updatedItem = response.data.item;

        setItems((current) =>
          current.map((item) =>
            String(item.id) === String(editingId)
              ? updatedItem
              : item
          )
        );

        setNotice("Food item updated successfully.");
      } else {
        const response = await api.post("/api/food-items", payload);

        setItems((current) => [response.data.item, ...current]);
        setNotice("Food item added successfully.");
      }

      closeModal();
    } catch (error) {
      console.error("Unable to save food item:", error);

      setError(
        error.response?.data?.error ||
          "Unable to save the food item. Check that the backend is running."
      );
    }
  }


  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Delete "${item.name}" from your inventory?`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/api/food-items/${item.id}`);

      setItems((current) =>
        current.filter(
          (existing) => String(existing.id) !== String(item.id)
        )
      );

      setNotice(`${item.name} removed from inventory.`);
    } catch (error) {
      console.error("Unable to delete food item:", error);

      setNotice(
        error.response?.data?.error ||
          "Unable to delete the food item. Please try again."
      );
    }
  }

  function resetFilters() {
    setSearch("");
    setCategoryFilter("All");
    setStatusFilter("All");
  }

  return (
    <div className="inventory-page">
      <div className="inventory-page-heading">
        <div>
          <div className="eyebrow">FOODWISE AI WORKSPACE</div>
          <h1>Food Inventory</h1>
          <p>Manage stock levels, food categories and expiry dates.</p>
        </div>

        <button className="primary-button" onClick={openAddModal}>
          <Plus size={18} />
          Add Food Item
        </button>
      </div>

      {notice && (
        <div className="inventory-notice" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="inventory-summary-grid">
        <article className="inventory-summary-card">
          <div className="inventory-summary-icon summary-green">
            <Package size={21} />
          </div>
          <div>
            <span>Total food items</span>
            <strong>{items.length}</strong>
            <small>Tracked in inventory</small>
          </div>
        </article>

        <article className="inventory-summary-card">
          <div className="inventory-summary-icon summary-blue">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <span>Total stock quantity</span>
            <strong>{totalQuantity.toLocaleString("en-IN")}</strong>
            <small>Combined units; units may differ</small>
          </div>
        </article>

        <article className="inventory-summary-card">
          <div className="inventory-summary-icon summary-orange">
            <AlertTriangle size={21} />
          </div>
          <div>
            <span>Expiry alerts</span>
            <strong>{expiringCount}</strong>
            <small>Expired or expiring within 3 days</small>
          </div>
        </article>
      </div>

      <section className="panel inventory-management-panel">
        <div className="inventory-toolbar">
          <label className="inventory-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search food items..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search food inventory"
            />
          </label>

          <div className="inventory-filters">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by expiry status"
            >
              <option value="All">All expiry statuses</option>
              <option value="Fresh">Fresh</option>
              <option value="Expiring">Expiry alerts</option>
            </select>
          </div>
        </div>

        <div className="inventory-results-heading">
          <div>
            <h2>Inventory items</h2>
            <p>
              {filteredItems.length} of {items.length} items displayed
            </p>
          </div>

          {(search || categoryFilter !== "All" || statusFilter !== "All") && (
            <button className="text-button" onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="inventory-management-table-wrap">
          <table className="inventory-management-table">
            <thead>
              <tr>
                <th>FOOD ITEM</th>
                <th>CATEGORY</th>
                <th>QUANTITY</th>
                <th>EXPIRY DATE</th>
                <th>EXPIRY STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading inventory...</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const expiry = getExpiryStatus(item.expiryDate);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-item-name">
                          <div className="inventory-item-symbol">
                            <Package size={17} />
                          </div>
                          <strong>{item.name}</strong>
                        </div>
                      </td>

                      <td>
                        <span className="inventory-category">
                          {item.category}
                        </span>
                      </td>

                      <td className="inventory-quantity">
                        {Number(item.quantity).toLocaleString("en-IN")}{" "}
                        <span>{item.unit}</span>
                      </td>

                      <td>
                        {item.expiryDate
                          ? new Date(
                              `${item.expiryDate}T00:00:00`
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      <td>
                        <span className={`expiry-badge expiry-${expiry.type}`}>
                          {expiry.type === "danger" ||
                          expiry.type === "warning" ? (
                            <AlertTriangle size={13} />
                          ) : expiry.type === "success" ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <Clock size={13} />
                          )}
                          {expiry.label}
                        </span>
                      </td>

                      <td>
                        <div className="inventory-row-actions">
                          <button
                            className="row-action-button"
                            aria-label={`Edit ${item.name}`}
                            title="Edit item"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            className="row-action-button row-action-delete"
                            aria-label={`Delete ${item.name}`}
                            title="Delete item"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
            </tbody>
          </table>

          {filteredItems.length === 0 && (
            <div className="inventory-empty-state">
              <Package size={32} />
              <h3>No food items found</h3>
              <p>Try changing your search or category filters.</p>
              <button className="text-button" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="inventory-table-footer">
          <span>
            <span className="inventory-live-dot" />
            Inventory stored in the FoodWise database
          </span>
          <span>Showing {filteredItems.length} items</span>
        </div>
      </section>

      {modalOpen && (
        <div
          className="inventory-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-modal-title"
          >
            <div className="inventory-modal-heading">
              <div>
                <span className="eyebrow">
                  FOODWISE AI · INVENTORY
                </span>
                <h2 id="inventory-modal-title">
                  {editingId ? "Edit Food Item" : "Add Food Item"}
                </h2>
                <p>
                  Enter the food details to update your inventory.
                </p>
              </div>

              <button
                className="icon-button"
                aria-label="Close form"
                onClick={closeModal}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="inventory-form-field">
                <label htmlFor="food-name">Food item name *</label>
                <input
                  id="food-name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. Fresh Tomatoes"
                  maxLength={100}
                  required
                />
              </div>

              <div className="inventory-form-row">
                <div className="inventory-form-field">
                  <label htmlFor="food-category">Category *</label>
                  <select
                    id="food-category"
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    required
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inventory-form-field">
                  <label htmlFor="food-quantity">Quantity *</label>
                  <input
                    id="food-quantity"
                    name="quantity"
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.quantity}
                    onChange={handleFormChange}
                    placeholder="e.g. 25"
                    required
                  />
                </div>
              </div>

              <div className="inventory-form-row">
                <div className="inventory-form-field">
                  <label htmlFor="food-unit">Unit *</label>
                  <select
                    id="food-unit"
                    name="unit"
                    value={form.unit}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="litres">Litres</option>
                    <option value="ml">Millilitres (ml)</option>
                    <option value="pieces">Pieces</option>
                    <option value="packets">Packets</option>
                  </select>
                </div>

                <div className="inventory-form-field">
                  <label htmlFor="food-expiry">Expiry date *</label>
                  <input
                        id="food-expiry"
                    name="expiryDate"
                    type="date"
                    value={form.expiryDate}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="inventory-form-error" role="alert">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  {editingId ? "Save Changes" : "Add to Inventory"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
