import { useState } from "react";
import {
Upload,
FileSpreadsheet,
Download,
CheckCircle2,
AlertCircle,
Trash2,
FileCheck,
} from "lucide-react";

import api from "../api";

const REQUIRED_COLUMNS = {
  consumption: ["foodItem", "date", "prepared", "consumed", "unit"],
  inventory: ["name", "quantity", "unit"],
};

function parseCSV(text) {
const rows = [];
let row = [];
let value = "";
let insideQuotes = false;

const input = text.replace(/^\uFEFF/, "");

for (let i = 0; i < input.length; i += 1) {
const char = input[i];
const next = input[i + 1];

if (char === '"') {
  if (insideQuotes && next === '"') {
    value += '"';
    i += 1;
  } else {
    insideQuotes = !insideQuotes;
  }
} else if (char === "," && !insideQuotes) {
  row.push(value.trim());
  value = "";
} else if ((char === "\n" || char === "\r") && !insideQuotes) {
  if (char === "\r" && next === "\n") i += 1;

  row.push(value.trim());

  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  row = [];
  value = "";
} else {
  value += char;
}

}

row.push(value.trim());

if (row.some((cell) => cell !== "")) {
rows.push(row);
}

if (insideQuotes) {
throw new Error("The CSV contains an unclosed quotation mark.");
}

return rows;
}

async function getExistingRecords(importType) {
try {
const response = await api.get(
  importType === "inventory" ? "/api/food-items" : "/api/consumption"
);
return importType === "inventory" ? response.data.items : response.data.records;
} catch (error) {
throw new Error(
error.response?.data?.message ||
error.response?.data?.error ||
`Could not read existing ${importType} data from the backend.`
);
}
}

function makeDuplicateKey(record, importType) {
if (importType === "inventory") {
  return String(record.name || "").trim().toLowerCase();
}

return [
String(record.foodItem || "").trim().toLowerCase(),
String(record.date || "").trim(),
Number(record.prepared),
Number(record.consumed),
String(record.unit || "").trim().toLowerCase(),
].join("|");
}

function isValidDate(date) {
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

const parsed = new Date(`${date}T00:00:00.000Z`);

return (
!Number.isNaN(parsed.getTime()) &&
parsed.toISOString().slice(0, 10) === date
);
}

function DataImport() {
const [fileName, setFileName] = useState("");
const [preview, setPreview] = useState([]);
const [errors, setErrors] = useState([]);
const [duplicates, setDuplicates] = useState([]);
const [message, setMessage] = useState("");
const [messageType, setMessageType] = useState("");
const [loading, setLoading] = useState(false);
const [importType, setImportType] = useState("consumption");

const resetPage = () => {
setFileName("");
setPreview([]);
setErrors([]);
setDuplicates([]);
setMessage("");
setMessageType("");
};

const handleFile = async (file) => {
resetPage();

if (!file) return;

if (!file.name.toLowerCase().endsWith(".csv")) {
  setMessage("Please select a CSV file.");
  setMessageType("error");
  return;
}

if (file.size > 5 * 1024 * 1024) {
  setMessage("File size must not exceed 5 MB.");
  setMessageType("error");
  return;
}

setLoading(true);

try {
  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    throw new Error(
      "The file must contain a header and at least one data row."
    );
  }

  const headers = rows[0].map((header) =>
    header.trim().replace(/^"|"$/g, "")
  );

  const missingColumns = REQUIRED_COLUMNS[importType].filter(
    (column) => !headers.includes(column)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingColumns.join(", ")}`
    );
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("The CSV contains duplicate column names.");
  }

  const existingRecords = await getExistingRecords(importType);

  const existingKeys = new Set(
    existingRecords.map((record) => makeDuplicateKey(record, importType))
  );

  const seenKeys = new Set();
  const validRecords = [];
  const invalidRows = [];
  const duplicateRows = [];

  rows.slice(1).forEach((values, index) => {
    const rowNumber = index + 2;

    if (values.length !== headers.length) {
      invalidRows.push({
        row: rowNumber,
        reason: "Column count does not match the header.",
      });
      return;
    }

    const recordData = {};

    headers.forEach((header, columnIndex) => {
      recordData[header] = values[columnIndex];
    });

    if (importType === "inventory") {
      const name = String(recordData.name || "").trim();
      const quantityText = String(recordData.quantity ?? "").trim();
      const quantity = Number(quantityText);
      const unit = String(recordData.unit || "").trim();
      const category = String(recordData.category || "Other").trim();
      const expiryDate = String(recordData.expiryDate || "").trim();

      if (!name || !unit || !category) {
        invalidRows.push({
          row: rowNumber,
          reason: "Name, unit, and category must not be empty.",
        });
        return;
      }

      if (
        quantityText === "" ||
        !Number.isFinite(quantity) ||
        quantity < 0
      ) {
        invalidRows.push({
          row: rowNumber,
          reason: "Quantity must be a non-negative number.",
        });
        return;
      }

      if (expiryDate && !isValidDate(expiryDate)) {
        invalidRows.push({
          row: rowNumber,
          reason: "Expiry date must be a valid date in YYYY-MM-DD format.",
        });
        return;
      }

      const item = {
        id: `import-${Date.now()}-${rowNumber}`,
        name,
        category,
        quantity,
        unit,
        expiryDate: expiryDate || null,
      };
      const key = makeDuplicateKey(item, importType);
      if (existingKeys.has(key) || seenKeys.has(key)) {
        duplicateRows.push({
          row: rowNumber,
          reason: "An inventory item with this name already exists.",
        });
        return;
      }
      seenKeys.add(key);
      validRecords.push(item);
      return;
    }

    const foodItem = String(recordData.foodItem || "").trim();
    const date = String(recordData.date || "").trim();
    const unit = String(recordData.unit || "").trim();
    const preparedText = String(recordData.prepared ?? "").trim();
    const consumedText = String(recordData.consumed ?? "").trim();

    const prepared = Number(preparedText);
    const consumed = Number(consumedText);

    if (!foodItem || !date || !unit) {
      invalidRows.push({
        row: rowNumber,
        reason: "Food item, date, and unit are required.",
      });
      return;
    }

    if (!isValidDate(date)) {
      invalidRows.push({
        row: rowNumber,
        reason: "Date must be a valid date in YYYY-MM-DD format.",
      });
      return;
    }

    if (
      preparedText === "" ||
      consumedText === "" ||
      !Number.isFinite(prepared) ||
      !Number.isFinite(consumed)
    ) {
      invalidRows.push({
        row: rowNumber,
        reason: "Prepared and consumed quantities must be numbers.",
      });
      return;
    }

    if (prepared <= 0 || consumed < 0) {
      invalidRows.push({
        row: rowNumber,
        reason: "Prepared quantity must be positive and consumed quantity cannot be negative.",
      });
      return;
    }

    if (consumed > prepared) {
      invalidRows.push({
        row: rowNumber,
        reason: "Consumed quantity cannot exceed prepared quantity.",
      });
      return;
    }

    const record = {
      id: `import-${Date.now()}-${rowNumber}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      foodItem,
      date,
      prepared,
      consumed,
      wasted: prepared - consumed,
      unit,
      notes: String(recordData.notes || "").trim(),
      createdAt: new Date().toISOString(),
    };

    const key = makeDuplicateKey(record, importType);

    if (existingKeys.has(key) || seenKeys.has(key)) {
      duplicateRows.push({
        row: rowNumber,
        reason: "Duplicate record skipped.",
      });
      return;
    }

    seenKeys.add(key);
    validRecords.push(record);
  });

  if (validRecords.length > 5000) {
    throw new Error("A maximum of 5,000 records can be imported at once.");
  }

  setFileName(file.name);
  setPreview(validRecords);
  setErrors(invalidRows);
  setDuplicates(duplicateRows);

  if (invalidRows.length > 0) {
    setMessage(
      `Validation completed. ${validRecords.length} valid record(s), ${invalidRows.length} invalid row(s).`
    );
    setMessageType("warning");
  } else {
    setMessage("CSV validated successfully. Review the records below.");
    setMessageType("success");
  }
} catch (error) {
  setMessage(error.message || "Unable to read the selected CSV file.");
  setMessageType("error");
} finally {
  setLoading(false);
}

};

const importRecords = async () => {
if (preview.length === 0) {
setMessage("There are no valid new records to import.");
setMessageType("warning");
return;
}

setLoading(true);
try {
  const existingRecords = await getExistingRecords(importType);
  const existingKeys = new Set(
    existingRecords.map((record) => makeDuplicateKey(record, importType))
  );

  const recordsToSave = preview.filter(
    (record) => !existingKeys.has(makeDuplicateKey(record, importType))
  );

  if (recordsToSave.length === 0) {
    setMessage("No new records are available to import.");
    setMessageType("warning");
    return;
  }

  const response = importType === "inventory"
    ? await api.post("/api/food-items/bulk", { items: recordsToSave })
    : await api.post("/api/consumption/bulk", { records: recordsToSave });

  setMessage(
    `Imported ${response.data.count} ${importType === "inventory" ? "item(s)" : "record(s)"}; skipped ${response.data.skipped} duplicate(s).`
  );
  setMessageType("success");
  setPreview([]);
} catch (error) {
  setMessage(
    error.response?.data?.message ||
      error.message ||
      "Import failed. Check that the backend is running."
  );
  setMessageType("error");
} finally {
  setLoading(false);
}

};

const downloadTemplate = () => {
const rows = importType === "inventory"
  ? [
      "name,category,quantity,unit,expiryDate",
      "Rice,Grains,25,kg,2027-01-15",
      "Tomatoes,Vegetables,12,kg,2026-11-10",
      "Milk,Dairy,8,litres,",
    ]
  : [
      "foodItem,date,prepared,consumed,unit,notes",
      'Rice,2026-10-10,50,42,kg,"Lunch service"',
      'Dal,2026-10-10,20,18,litres,"Lunch service"',
      'Roti,2026-10-10,200,185,pieces,"Dinner service"',
    ];
const csv = rows.join("\r\n");

const blob = new Blob(["\uFEFF", csv], {
  type: "text/csv;charset=utf-8;",
});

const url = URL.createObjectURL(blob);
const anchor = document.createElement("a");

anchor.href = url;
anchor.download = `foodwise-${importType}-import-template.csv`;

document.body.appendChild(anchor);
anchor.click();
anchor.remove();

URL.revokeObjectURL(url);

};

return (
<div className="data-import-page">
<div className="data-import-header">
<div>
<h1>Data Import</h1>
<p>
{importType === "inventory"
  ? "Add food inventory items in bulk using a CSV file."
  : "Upload historical food preparation and consumption records using a CSV file."}
</p>
</div>

    <button
      type="button"
      className="data-import-template-button"
      onClick={downloadTemplate}
    >
      <Download size={17} />
      Download template
    </button>
  </div>

  <div className="data-import-info">
    <FileCheck size={21} />
    <div>
      <strong>Required CSV columns</strong>
      <p>
        {importType === "inventory"
          ? "Required: name, quantity, and unit. Category and expiryDate are optional; use YYYY-MM-DD for expiry dates."
          : "Required: foodItem, date, prepared, consumed, and unit. Use YYYY-MM-DD for dates. The notes column is optional."}
      </p>
    </div>
  </div>

  <label className="data-import-type">
    <span>Data to import</span>
    <select
      value={importType}
      disabled={loading}
      onChange={(event) => {
        setImportType(event.target.value);
        resetPage();
      }}
    >
      <option value="consumption">Consumption records</option>
      <option value="inventory">Food inventory</option>
    </select>
  </label>

  <div className="data-import-dropzone">
    <div className="data-import-upload-icon">
      <Upload size={28} />
    </div>

    <h2>{loading ? "Processing CSV..." : "Upload your CSV file"}</h2>

    <p>
      Select a CSV file from your computer to validate and preview
      {importType === "inventory" ? " your inventory items." : " your consumption records."}
    </p>

    <span className="data-import-file-limit">
      CSV format · Maximum file size 5 MB
    </span>

    <label className="data-import-select-button">
      <FileSpreadsheet size={17} />
      Choose CSV file
      <input
        type="file"
        accept=".csv,text/csv"
        hidden
        disabled={loading}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  </div>

  {message && (
    <div className={`data-import-message ${messageType}`}>
      {messageType === "success" ? (
        <CheckCircle2 size={19} />
      ) : (
        <AlertCircle size={19} />
      )}
      <span>{message}</span>
    </div>
  )}

  {fileName && (
    <div className="data-import-file-card">
      <div className="data-import-file-icon">
        <FileSpreadsheet size={22} />
      </div>

      <div className="data-import-file-details">
        <strong>{fileName}</strong>
        <span>
          {preview.length} valid record(s) ready for import ·{" "}
          {errors.length} invalid row(s) · {duplicates.length} duplicate(s)
        </span>
      </div>

      <button
        type="button"
        className="data-import-clear-button"
        onClick={resetPage}
        title="Clear import"
        aria-label="Clear import"
      >
        <Trash2 size={17} />
      </button>
    </div>
  )}

  {preview.length > 0 && (
    <section className="data-import-section">
      <div className="data-import-section-header">
        <div>
          <h2>Import preview</h2>
          <p>
            Review the validated records before saving them.
          </p>
        </div>
      </div>

      <div className="data-import-table-wrapper">
        <table className="data-import-table">
          <thead>
            <tr>
              {importType === "inventory" ? (
                <>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Expiry Date</th>
                </>
              ) : (
                <>
                  <th>Food item</th>
                  <th>Date</th>
                  <th>Prepared</th>
                  <th>Consumed</th>
                  <th>Wasted</th>
                  <th>Unit</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {preview.slice(0, 10).map((record) => (
              <tr key={record.id}>
                {importType === "inventory" ? (
                  <>
                    <td>{record.name}</td>
                    <td>{record.category}</td>
                    <td>{record.quantity}</td>
                    <td>{record.unit}</td>
                    <td>{record.expiryDate || "—"}</td>
                  </>
                ) : (
                  <>
                    <td>{record.foodItem}</td>
                    <td>{record.date}</td>
                    <td>{record.prepared}</td>
                    <td>{record.consumed}</td>
                    <td>{record.wasted}</td>
                    <td>{record.unit}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.length > 10 && (
        <p className="data-import-more">
          Showing 10 of {preview.length} valid records.
        </p>
      )}

      <div className="data-import-actions">
        <button
          type="button"
          className="data-import-confirm-button"
          onClick={importRecords}
        >
          <CheckCircle2 size={17} />
          Import {preview.length} {importType === "inventory" ? "item(s)" : "record(s)"}
        </button>
      </div>
    </section>
  )}

  {errors.length > 0 && (
    <section className="data-import-section">
      <div className="data-import-section-header">
        <div>
          <h2>Rows requiring correction</h2>
          <p>These rows were not included in the import preview.</p>
        </div>
      </div>

      <div className="data-import-errors">
        {errors.map((error, index) => (
          <div
            className="data-import-error-row"
            key={`${error.row}-${index}`}
          >
            <strong>Row {error.row}</strong>
            <span>{error.reason}</span>
          </div>
        ))}
      </div>
    </section>
  )}

  {duplicates.length > 0 && (
    <section className="data-import-section">
      <div className="data-import-section-header">
        <div>
          <h2>Duplicate rows skipped</h2>
          <p>These records matched an existing or repeated record.</p>
        </div>
      </div>

      <div className="data-import-errors">
        {duplicates.map((duplicate, index) => (
          <div
            className="data-import-warning-row"
            key={`${duplicate.row}-${index}`}
          >
            <strong>Row {duplicate.row}</strong>
            <span>{duplicate.reason}</span>
          </div>
        ))}
      </div>
    </section>
  )}

  <div className="data-import-disclaimer">
    <AlertCircle size={18} />
    <p>
      <strong>Storage note:</strong> Imported data is saved to the
      FoodWise database and is available across the application.
    </p>
  </div>
</div>

);
}

export default DataImport;