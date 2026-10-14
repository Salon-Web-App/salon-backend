// components/StaffEdit.jsx
//
// Full custom "edit" page for the Staff resource. Because this replaces
// the ENTIRE default edit action (not a single property), AdminJS does
// NOT wrap it in a form or supply an onChange prop or a Save button —
// this component owns its own local state and explicitly calls the
// record's "edit" action via ApiClient to persist changes.

import React, { useEffect, useRef, useState } from "react";
import { Input, CheckBox, Select } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

function parseValue(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readWorkingHours(record, propertyName) {
  const params = record?.params || {};
  if (params[propertyName]) return parseValue(params[propertyName]);

  const prefix = `${propertyName}.`;
  const result = {};
  Object.keys(params)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => {
      const rest = key.slice(prefix.length);
      const [day, idxStr] = rest.split(".");
      if (!day) return;
      if (!result[day]) result[day] = [];
      const idx = Number(idxStr);
      if (!Number.isNaN(idx)) result[day][idx] = params[key];
      else result[day].push(params[key]);
    });
  return result;
}

function readServiceIds(record, propertyName) {
  const params = record?.params || {};
  if (Array.isArray(params[propertyName])) return params[propertyName];

  const idKeyPattern = new RegExp(`^${propertyName}\\.(\\d+)\\.id$`);
  const idEntries = Object.keys(params)
    .map((key) => {
      const match = key.match(idKeyPattern);
      return match ? { index: Number(match[1]), id: params[key] } : null;
    })
    .filter(Boolean);
  if (idEntries.length) {
    return idEntries
      .sort((a, b) => a.index - b.index)
      .map((e) => e.id)
      .filter(Boolean);
  }

  const flatPrefix = `${propertyName}.`;
  return Object.keys(params)
    .filter((key) => key.startsWith(flatPrefix) && /^\d+$/.test(key.slice(flatPrefix.length)))
    .sort((a, b) => Number(a.slice(flatPrefix.length)) - Number(b.slice(flatPrefix.length)))
    .map((key) => params[key])
    .filter((v) => v !== undefined && v !== null && v !== "");
}

function rangeToTimes(range) {
  if (!range) return { start: "09:00", end: "17:00" };
  const [start, end] = range.split("-");
  return { start: start || "09:00", end: end || "17:00" };
}

const styles = {
  page: { maxWidth: 760, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "24px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 24,
  },
  photoWrap: { position: "relative", flexShrink: 0, cursor: "pointer" },
  photo: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    background: "#eef1f7",
    display: "block",
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 600,
    color: "#8892a6",
  },
  photoOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    opacity: 0,
    transition: "opacity 0.15s",
  },
  nameInput: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1d24",
    border: "none",
    borderBottom: "2px solid transparent",
    outline: "none",
    padding: "2px 0",
    width: "100%",
    background: "transparent",
  },
  activeRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
    marginBottom: 12,
  },
  section: { marginBottom: 32 },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#8892a6",
    marginBottom: 4,
    display: "block",
  },
  textInput: {
    width: "100%",
    fontSize: 14,
    padding: "8px 10px",
    border: "1px solid #dfe2ea",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#eef1f7",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    marginRight: 8,
    marginBottom: 8,
    color: "#1a1d24",
  },
  removeBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
    color: "#555",
  },
  scheduleRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "8px 4px",
    borderBottom: "1px solid #f0f1f4",
  },
  dayLabelWrap: { width: 150, display: "flex", alignItems: "center", gap: 8 },
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
  footer: {
    display: "flex",
    gap: 12,
    paddingTop: 20,
    marginTop: 8,
    borderTop: "1px solid #e5e7eb",
  },
  saveBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #dfe2ea",
    background: "#fff",
    color: "#333",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
};

const StaffEdit = (props) => {
  const { record } = props;
  // AdminJS doesn't hand this component a real record on the "new" page —
  // record comes through as undefined there, only existing on "edit"/"show".
  // Every place below that touches record.id has to branch on this instead
  // of assuming a record (and its id) always exist.
  const isNew = !record?.id;
  const initialParams = record?.params || {};
  const fileInputRef = useRef(null);

  // --- Local form state (replaces the missing onChange plumbing) ---
  const [fields, setFields] = useState({
    name: initialParams.name || "",
    bio: initialParams.bio || "",
    specialty: initialParams.specialty || "",
    experience: initialParams.experience || "",
    active: Boolean(initialParams.active),
    photoUrl: initialParams.photoUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  // --- Services picker state ---
  const [allServices, setAllServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState(() =>
    readServiceIds(record, "services"),
  );

  useEffect(() => {
    let cancelled = false;
    api
      .resourceAction({
        resourceId: "Service",
        actionName: "list",
        params: { perPage: 500 },
      })
      .then((response) => {
        if (cancelled) return;
        const records = response?.data?.records || [];
        setAllServices(
          records.map((r) => ({
            value: r.id ?? r.params?.id,
            label: r.params?.name || r.title || `Service ${r.id}`,
          })),
        );
        setServicesLoading(false);
      })
      .catch(() => setServicesLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedServices = allServices.filter((s) => selectedServiceIds.includes(s.value));
  const availableServiceOptions = allServices.filter((s) => !selectedServiceIds.includes(s.value));

  function handleAddService(selected) {
    if (!selected) return;
    const value = selected.value !== undefined ? selected.value : selected;
    if (selectedServiceIds.includes(value)) return;
    setSelectedServiceIds((prev) => [...prev, value]);
  }

  function handleRemoveService(value) {
    setSelectedServiceIds((prev) => prev.filter((id) => id !== value));
  }

  // --- Working hours state ---
  const initialSchedule = readWorkingHours(record, "workingHours");
  const [schedule, setSchedule] = useState(() =>
    DAYS.reduce((acc, day) => {
      const existing = initialSchedule[day.key]?.[0];
      const times = rangeToTimes(existing);
      acc[day.key] = {
        enabled: Boolean(existing),
        start: times.start,
        end: times.end,
      };
      return acc;
    }, {}),
  );

  function updateDay(dayKey, field, value) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  }

  // --- Photo upload ---
  function handlePhotoPick() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("photoUrl", reader.result);
    reader.readAsDataURL(file);
  }

  // --- Save / Cancel ---
  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const workingHours = {};
      DAYS.forEach((day) => {
        const d = schedule[day.key];
        if (d.enabled) workingHours[day.key] = [`${d.start}-${d.end}`];
      });

      const data = {
        name: fields.name,
        bio: fields.bio,
        specialty: fields.specialty,
        experience: fields.experience,
        active: fields.active,
        photoUrl: fields.photoUrl,
        workingHours: JSON.stringify(workingHours),
        services: selectedServiceIds,
      };

      if (isNew) {
        const res = await api.resourceAction({
          resourceId: "Staff",
          actionName: "new",
          data,
        });
        const newId = res?.data?.record?.params?.id;
        window.location.href = newId
          ? `/backoffice/resources/Staff/records/${newId}/show`
          : "/backoffice/resources/Staff";
      } else {
        await api.recordAction({
          resourceId: "Staff",
          recordId: record.id,
          actionName: "edit",
          data,
        });
        window.location.href = `/backoffice/resources/Staff/records/${record.id}/show`;
      }
    } catch (err) {
      setError(
        err?.response?.data?.errors?.[0]?.message ||
          err.message ||
          (isNew ? "Failed to create staff member" : "Failed to save changes"),
      );
      setSaving(false);
    }
  }

  function handleCancel() {
    window.location.href = isNew
      ? "/backoffice/resources/Staff"
      : `/backoffice/resources/Staff/records/${record.id}/show`;
  }

  const initials = (fields.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={styles.page}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.header}>
        <div
          style={styles.photoWrap}
          onClick={handlePhotoPick}
          onMouseEnter={(e) => {
            const overlay = e.currentTarget.querySelector("[data-overlay]");
            if (overlay) overlay.style.opacity = 1;
          }}
          onMouseLeave={(e) => {
            const overlay = e.currentTarget.querySelector("[data-overlay]");
            if (overlay) overlay.style.opacity = 0;
          }}
        >
          {fields.photoUrl ? (
            <img src={fields.photoUrl} alt={fields.name} style={styles.photo} />
          ) : (
            <div style={styles.photoPlaceholder}>{initials}</div>
          )}
          <div data-overlay style={styles.photoOverlay}>
            Change
            <br />
            photo
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            style={styles.nameInput}
            value={fields.name}
            placeholder="Staff name"
            onChange={(e) => setField("name", e.target.value)}
          />
          <div style={styles.activeRow}>
            <CheckBox
              id="staff-active"
              checked={fields.active}
              onChange={() => setField("active", !fields.active)}
            />
            <label htmlFor="staff-active" style={{ fontSize: 13, color: "#555" }}>
              Active
            </label>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Profile</div>
        <div style={styles.infoGrid}>
          <div>
            <label style={styles.fieldLabel}>Specialty</label>
            <input
              style={styles.textInput}
              value={fields.specialty}
              onChange={(e) => setField("specialty", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Experience</label>
            <input
              style={styles.textInput}
              value={fields.experience}
              onChange={(e) => setField("experience", e.target.value)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={styles.fieldLabel}>Bio</label>
            <textarea
              style={{ ...styles.textInput, minHeight: 80, resize: "vertical" }}
              value={fields.bio}
              onChange={(e) => setField("bio", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Services</div>
        <div style={{ marginBottom: 12 }}>
          {selectedServices.length === 0 && (
            <span style={styles.empty}>No services assigned yet.</span>
          )}
          {selectedServices.map((s) => (
            <span key={s.value} style={styles.chip}>
              {s.label}
              <button
                type="button"
                style={styles.removeBtn}
                onClick={() => handleRemoveService(s.value)}
                aria-label={`Remove ${s.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <Select
          isLoading={servicesLoading}
          placeholder={
            availableServiceOptions.length ? "Add a service…" : "All services are already assigned"
          }
          options={availableServiceOptions}
          value={null}
          onChange={handleAddService}
          isDisabled={availableServiceOptions.length === 0 || servicesLoading}
          isClearable={false}
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Working Hours</div>
        <div>
          {DAYS.map((day) => (
            <div key={day.key} style={styles.scheduleRow}>
              <div style={styles.dayLabelWrap}>
                <CheckBox
                  id={`wh-${day.key}`}
                  checked={schedule[day.key].enabled}
                  onChange={() => updateDay(day.key, "enabled", !schedule[day.key].enabled)}
                />
                <label htmlFor={`wh-${day.key}`} style={{ fontSize: 14 }}>
                  {day.label}
                </label>
              </div>
              <Input
                type="time"
                value={schedule[day.key].start}
                disabled={!schedule[day.key].enabled}
                onChange={(e) => updateDay(day.key, "start", e.target.value)}
                width="120px"
              />
              <span style={{ fontSize: 13, color: "#8892a6" }}>to</span>
              <Input
                type="time"
                value={schedule[day.key].end}
                disabled={!schedule[day.key].enabled}
                onChange={(e) => updateDay(day.key, "end", e.target.value)}
                width="120px"
              />
            </div>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
        <button
          type="button"
          style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" style={styles.cancelBtn} disabled={saving} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default StaffEdit;
