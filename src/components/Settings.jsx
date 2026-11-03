import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  TrendingUp,
  Trash2,
  Save,
  RotateCcw,
  Moon,
  Sun,
  Bell,
  Database,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import api from "../api";

const SETTINGS_KEY = "foodwise_app_settings_v1";

const DEFAULT_SETTINGS = {
  organizationName: "My Food Service",
  facilityType: "College Canteen",
  safetyBuffer: 10,
  wasteTarget: 10,
  theme: "light",
  wasteAlerts: true,
};

function readSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function Settings() {
  const [settings, setSettings] = useState(readSettings);
  const [savedMessage, setSavedMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [recordCounts, setRecordCounts] = useState({
    consumption: 0,
    inventory: 0,
  });

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get("/api/consumption"),
      api.get("/api/food-items"),
    ])
      .then(([consumptionResponse, inventoryResponse]) => {
        if (active) {
          setRecordCounts({
            consumption: consumptionResponse.data.count,
            inventory: inventoryResponse.data.count,
          });
        }
      })
      .catch((error) => {
        console.error("Unable to load stored data counts:", error);
        if (active) {
          setDataError(
            error.response?.data?.message ||
              "Unable to load record counts. Check that the backend is running."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  function updateSetting(field, value) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
    setSavedMessage("");
  }

  function saveSettings(event) {
    event.preventDefault();

    const organizationName = settings.organizationName.trim();
    const safetyBuffer = Number(settings.safetyBuffer);
    const wasteTarget = Number(settings.wasteTarget);
    if (!organizationName) {
      setSavedMessage("Enter an organization name before saving.");
      return;
    }

    if (
      !Number.isFinite(safetyBuffer) ||
      safetyBuffer < 0 ||
      safetyBuffer > 100 ||
      !Number.isFinite(wasteTarget) ||
      wasteTarget < 0 ||
      wasteTarget > 100
    ) {
      setSavedMessage("Forecast buffer and waste target must be between 0 and 100.");
      return;
    }

    try {
      const savedSettings = { ...settings, organizationName };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(savedSettings));
      setSettings(savedSettings);
      window.dispatchEvent(new Event("foodwise-settings-changed"));

      setSavedMessage("Settings saved successfully.");
    } catch (error) {
      console.error("Unable to save settings:", error);
      setSavedMessage("Unable to save settings in this browser.");
    }
  }

  function resetSettings() {
    setSettings({ ...DEFAULT_SETTINGS });
    setSavedMessage("");
  }

  async function clearApplicationData() {
    try {
      await api.delete("/api/data");
      setShowClearConfirmation(false);
      setRecordCounts({ consumption: 0, inventory: 0 });
      setDataError("");
      setSavedMessage("Consumption and inventory records were cleared.");
    } catch (error) {
      console.error("Unable to clear application data:", error);
      setDataError(
        error.response?.data?.message ||
          "Unable to clear data. Check that the backend is running."
      );
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Configure your FoodWise AI workspace and preferences.</p>
        </div>

        <div className="settings-header-icon">
          <SettingsIcon size={24} />
        </div>
      </header>

      <form onSubmit={saveSettings}>
        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <Building2 size={20} />
            </div>
            <div>
              <h2>Organization</h2>
              <p>Customize your food service workspace.</p>
            </div>
          </div>

          <div className="settings-form-grid">
            <div className="settings-field">
              <label htmlFor="organization-name">Organization Name</label>
              <input
                id="organization-name"
                type="text"
                maxLength={100}
                required
                value={settings.organizationName}
                onChange={(event) =>
                  updateSetting("organizationName", event.target.value)
                }
                placeholder="Enter organization name"
              />
            </div>

            <div className="settings-field">
              <label htmlFor="facility-type">Facility Type</label>
              <select
                id="facility-type"
                value={settings.facilityType}
                onChange={(event) =>
                  updateSetting("facilityType", event.target.value)
                }
              >
                <option>College Canteen</option>
                <option>Hostel Mess</option>
                <option>Restaurant</option>
                <option>Hotel</option>
                <option>Hospital Cafeteria</option>
                <option>Corporate Cafeteria</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2>Forecast Preferences</h2>
              <p>Set preparation and waste-monitoring targets.</p>
            </div>
          </div>

          <div className="settings-form-grid">
            <div className="settings-field">
              <label htmlFor="safety-buffer">
                Preparation Safety Buffer
              </label>
              <div className="settings-input-suffix">
                <input
                  id="safety-buffer"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.safetyBuffer}
                  onChange={(event) =>
                    updateSetting(
                      "safetyBuffer",
                      Math.max(0, Math.min(100, Number(event.target.value)))
                    )
                  }
                />
                <span>%</span>
              </div>
              <small>
                Additional quantity above the estimated demand. This setting
                is saved locally and does not yet control a trained model.
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="waste-target">Waste Target</label>
              <div className="settings-input-suffix">
                <input
                  id="waste-target"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.wasteTarget}
                  onChange={(event) =>
                    updateSetting(
                      "wasteTarget",
                      Math.max(0, Math.min(100, Number(event.target.value)))
                    )
                  }
                />
                <span>%</span>
              </div>
              <small>
                Your preferred maximum waste rate for monitoring.
              </small>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <Bell size={20} />
            </div>
            <div>
              <h2>Notifications</h2>
              <p>Configure your waste-monitoring preference.</p>
            </div>
          </div>

          <label className="settings-toggle-row">
            <div>
              <strong>Waste Alerts in Recommendations</strong>
              <p>
                Include or hide waste-target warnings in your recommendations.
              </p>
            </div>

            <input
              type="checkbox"
              checked={settings.wasteAlerts}
              onChange={(event) =>
                updateSetting("wasteAlerts", event.target.checked)
              }
            />
          </label>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              {settings.theme === "dark" ? (
                <Moon size={20} />
              ) : (
                <Sun size={20} />
              )}
            </div>
            <div>
              <h2>Appearance</h2>
              <p>Choose your preferred display mode.</p>
            </div>
          </div>

          <div className="settings-theme-options">
            <button
              type="button"
              className={`settings-theme-option ${
                settings.theme === "light" ? "active" : ""
              }`}
              onClick={() => updateSetting("theme", "light")}
            >
              <Sun size={19} />
              <span>Light Mode</span>
            </button>

            <button
              type="button"
              className={`settings-theme-option ${
                settings.theme === "dark" ? "active" : ""
              }`}
              onClick={() => updateSetting("theme", "dark")}
            >
              <Moon size={19} />
              <span>Dark Mode</span>
            </button>
          </div>

          <p className="settings-help-text">
            Your theme selection is saved on this browser and applied
            throughout the workspace.
          </p>
        </section>

        <section className="settings-card">
          <div className="settings-section-heading">
            <div className="settings-section-icon">
              <Database size={20} />
            </div>
            <div>
              <h2>Data Management</h2>
                  <p>Review the records stored in your FoodWise database.</p>
            </div>
          </div>

          <div className="settings-data-grid">
            <div className="settings-data-stat">
              <span>Consumption Records</span>
              <strong>{recordCounts.consumption}</strong>
            </div>

            <div className="settings-data-stat">
              <span>Inventory Items</span>
              <strong>{recordCounts.inventory}</strong>
            </div>
          </div>

          {dataError && (
            <p className="settings-help-text" role="alert">
              {dataError}
            </p>
          )}

          <p className="settings-help-text">
            This permanently deletes all consumption and inventory records
            from the FoodWise database. Export important data first.
          </p>

          {!showClearConfirmation ? (
            <button
              type="button"
              className="settings-danger-button"
              onClick={() => setShowClearConfirmation(true)}
            >
              <Trash2 size={17} />
              Clear Records
            </button>
          ) : (
            <div className="settings-confirm-box">
              <div>
                <AlertTriangle size={20} />
                <strong>Are you sure?</strong>
              </div>
              <p>
                This will permanently remove all consumption and inventory
                records from the FoodWise database.
              </p>
              <div className="settings-confirm-actions">
                <button
                  type="button"
                  className="settings-cancel-button"
                  onClick={() => setShowClearConfirmation(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="settings-danger-button"
                  onClick={clearApplicationData}
                >
                  Confirm Clear
                </button>
              </div>
            </div>
          )}
        </section>

        {savedMessage && (
          <div className="settings-status-message" role="status">
            <CheckCircle2 size={18} />
            {savedMessage}
          </div>
        )}

        <div className="settings-footer-actions">
          <button
            type="button"
            className="settings-reset-button"
            onClick={resetSettings}
          >
            <RotateCcw size={16} />
            Reset Form
          </button>

          <button type="submit" className="settings-save-button">
            <Save size={17} />
            Save Settings
          </button>
        </div>
      </form>

      <p className="settings-disclaimer">
        Preferences are stored in this browser. Inventory and consumption
        records are stored in the FoodWise database.
      </p>
    </div>
  );
}