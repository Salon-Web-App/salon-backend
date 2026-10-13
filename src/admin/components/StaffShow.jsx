// components/StaffShow.jsx
//
// Full custom "show" page for the Staff resource. Replaces AdminJS's
// default field-by-field show layout with a profile-style view: photo +
// name + status at the top, key info in a clean grid, a real weekly
// schedule table for working hours, and services rendered as badges
// (resolved from the ids attached by staffRecordAfter in admin.js).

import React, { useEffect, useState } from "react";
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

// Same reconstruction logic as WorkingHoursEdit — existing records carry
// the Json field flattened into workingHours.fri.0, workingHours.mon.0, ...
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

// Same shape-resolution as ServicesEdit/ServicesList — services is
// attached as a plain array of ids by the staffRecordAfter hook.
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
    .filter(
      (key) =>
        key.startsWith(flatPrefix) &&
        /^\d+$/.test(key.slice(flatPrefix.length)),
    )
    .sort(
      (a, b) =>
        Number(a.slice(flatPrefix.length)) - Number(b.slice(flatPrefix.length)),
    )
    .map((key) => params[key])
    .filter((v) => v !== undefined && v !== null && v !== "");
}

function formatRange(range) {
  if (!range) return null;
  const [start, end] = range.split("-");
  return `${start} – ${end}`;
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
  photo: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    background: "#eef1f7",
    flexShrink: 0,
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
    flexShrink: 0,
  },
  name: { fontSize: 24, fontWeight: 700, margin: 0, color: "#1a1d24" },
  statusBadge: (active) => ({
    display: "inline-block",
    marginTop: 8,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: active ? "#e6f6ec" : "#fdecec",
    color: active ? "#1d8a4c" : "#c0392b",
  }),
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
  infoLabel: { fontSize: 12, color: "#8892a6", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#1a1d24" },
  scheduleRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderBottom: "1px solid #f0f1f4",
    fontSize: 14,
  },
  dayLabel: { color: "#1a1d24", fontWeight: 500 },
  dayOff: { color: "#b0b6c3" },
  dayTime: { color: "#1a1d24" },
  chip: {
    display: "inline-block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    marginRight: 8,
    marginBottom: 8,
    color: "#1a1d24",
  },
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
};

const StaffShow = (props) => {
  const { record } = props;
  const params = record?.params || {};

  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);

  const serviceIds = readServiceIds(record, "services");
  const schedule = readWorkingHours(record, "workingHours");

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
        setServices(
          records.map((r) => ({
            value: r.id ?? r.params?.id,
            label: r.params?.name || r.title || `Service ${r.id}`,
          })),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load services.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const serviceNames = serviceIds
    .map((id) => services?.find((s) => s.value === id)?.label)
    .filter(Boolean);

  const initials = (params.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {params.photoUrl ? (
          <img src={params.photoUrl} alt={params.name} style={styles.photo} />
        ) : (
          <div style={styles.photoPlaceholder}>{initials}</div>
        )}
        <div>
          <h1 style={styles.name}>{params.name || "Unnamed staff"}</h1>
          {params.specialty && (
            <div style={{ fontSize: 14, color: "#8892a6", marginTop: 4 }}>
              {params.specialty}
            </div>
          )}
          <span style={styles.statusBadge(params.active)}>
            {params.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Profile</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Bio</div>
            <div style={styles.infoValue}>{params.bio || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Experience</div>
            <div style={styles.infoValue}>{params.experience || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Staff ID</div>
            <div style={styles.infoValue}>{params.id}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Joined</div>
            <div style={styles.infoValue}>
              {params.createdAt
                ? new Date(params.createdAt).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Services</div>
        {serviceIds.length === 0 && (
          <div style={styles.empty}>No services assigned.</div>
        )}
        {serviceIds.length > 0 && !services && (
          <div style={styles.empty}>Loading…</div>
        )}
        {serviceIds.length > 0 &&
          services &&
          (serviceNames.length > 0 ? (
            <div>
              {serviceNames.map((name) => (
                <span key={name} style={styles.chip}>
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>
              {serviceIds.length} service(s) assigned.
            </div>
          ))}
        {error && (
          <div style={{ color: "#c0392b", fontSize: 13, marginTop: 6 }}>
            {error}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Working Hours</div>
        <div>
          {DAYS.map((day) => {
            const range = schedule[day.key]?.[0];
            const formatted = formatRange(range);
            return (
              <div key={day.key} style={styles.scheduleRow}>
                <span style={styles.dayLabel}>{day.label}</span>
                <span style={formatted ? styles.dayTime : styles.dayOff}>
                  {formatted || "Closed"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StaffShow;
