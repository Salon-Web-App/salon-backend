// components/PackageCardList.jsx
//
// Full custom "list" page for the Package resource. Mirrors
// ServiceCardList/StaffCardList: a vertically stacked list of cards, each
// with a main clickable area (image, title, pricing, included services)
// and a right-side panel showing order/validity info.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const MOBILE_BREAKPOINT = 768;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return isMobile;
}

function readArrayParam(record, propertyName) {
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

function formatPrice(price) {
  if (price === undefined || price === null || price === "") return "—";
  const n = Number(price);
  return Number.isNaN(n) ? "—" : `Rs. ${n.toLocaleString()}`;
}

function formatDuration(minutes) {
  const n = Number(minutes);
  if (!n) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatBookingDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isFutureBooking(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

const styles = {
  page: { maxWidth: 850, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    paddingBottom: 16,
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: "#1a1d24" },
  subtitle: { fontSize: 13, color: "#8892a6", marginTop: 4 },
  addBtn: {
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    textDecoration: "none",
  },

  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: (isMobile) => ({
    position: "relative",
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "stretch",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    transition: "box-shadow 0.15s, border-color 0.15s",
    overflow: "hidden",
  }),
  mainClickable: (isMobile) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: isMobile ? 14 : 20,
    padding: isMobile ? 14 : 18,
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
    color: "inherit",
    textDecoration: "none",
  }),
  // Leaderboard-style rank pill, pinned to the card's top-left corner —
  // same idea as a #1/#2/#3 badge on a leaderboard row. Absolutely
  // positioned against `card` (position: relative), so it sits above
  // everything else regardless of avatar/content size.
  rankBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 1,
    display: "inline-block",
    background: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 9px",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },
  iconColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    objectFit: "cover",
    background: "#eef1f7",
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 600,
    color: "#8892a6",
    flexShrink: 0,
  },
  iconChip: {
    display: "block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 11,
    color: "#1a1d24",
    fontWeight: 600,
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  name: { fontSize: 16, fontWeight: 700, color: "#1a1d24" },
  statusBadge: (active) => ({
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: active ? "#e6f6ec" : "#fdecec",
    color: active ? "#1d8a4c" : "#c0392b",
  }),
  discountBadge: {
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: "#fff4e0",
    color: "#a6650a",
  },
  description: {
    fontSize: 13,
    color: "#4b5061",
    lineHeight: 1.5,
    marginTop: 6,
  },
  message: { fontSize: 12, color: "#a6650a", marginTop: 4, fontWeight: 600 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#b0b6c3",
    marginBottom: 6,
    marginTop: 10,
  },
  chip: {
    display: "inline-block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
    color: "#1a1d24",
  },
  empty: { color: "#b0b6c3", fontSize: 13, fontStyle: "italic" },
  loading: { color: "#8892a6", padding: 24, textAlign: "center" },

  panel: (isMobile) => ({
    width: isMobile ? "auto" : 220,
    flexShrink: 0,
    borderLeft: isMobile ? "none" : "1px solid #eceef2",
    borderTop: isMobile ? "1px solid #eceef2" : "none",
    background: "#fafbfc",
    padding: isMobile ? "12px 14px 14px" : 16,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    transition: "background 0.15s",
  }),
  panelHeader: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelValue: { fontSize: 13, color: "#1a1d24", fontWeight: 600 },
  panelSub: { fontSize: 12, color: "#8892a6", marginTop: 2 },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#8892a6",
    padding: "5px 0",
    borderBottom: "1px solid #eceef2",
  },
  bookingRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    padding: "5px 0",
    borderBottom: "1px solid #eceef2",
  },
  bookingCustomer: {
    fontSize: 12,
    color: "#1a1d24",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  bookingDate: { fontSize: 11, color: "#8892a6", flexShrink: 0 },
  panelEmpty: { fontSize: 12, color: "#b0b6c3", fontStyle: "italic" },
  moreLink: { fontSize: 11, color: "#4f46e5", fontWeight: 600, marginTop: 8 },

  filterRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  filterField: { display: "flex", flexDirection: "column", gap: 4 },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
  },
  filterSelect: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1d24",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #dfe2ea",
    background: "#fff",
    cursor: "pointer",
    minWidth: 180,
  },
  clearFilter: {
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #dfe2ea",
    background: "#fff",
    color: "#4b5061",
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
};

const PackageCardList = (props) => {
  const { resource } = props;
  const [records, setRecords] = useState(null);
  const [services, setServices] = useState([]);
  const [bookingsByPackage, setBookingsByPackage] = useState({});
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.resourceAction({
        resourceId: "Package",
        actionName: "list",
        params: { perPage: 500 },
      }),
      api
        .resourceAction({
          resourceId: "Service",
          actionName: "list",
          params: { perPage: 500 },
        })
        .catch(() => ({ data: { records: [] } })),
      api
        .resourceAction({
          resourceId: "Booking",
          actionName: "list",
          params: { perPage: 1000 },
        })
        .catch(() => ({ data: { records: [] } })),
    ]).then(([packageRes, serviceRes, bookingRes]) => {
      if (cancelled) return;
      setServices(
        (serviceRes?.data?.records || []).map((r) => ({
          value: r.id ?? r.params?.id,
          label: r.params?.name || `Service ${r.id}`,
        })),
      );

      const byPackage = {};
      (bookingRes?.data?.records || []).forEach((b) => {
        const bp = b.params || {};
        if (!bp.packageId || bp.deletedAt || bp.status === "cancelled") return;
        if (!byPackage[bp.packageId]) byPackage[bp.packageId] = [];
        byPackage[bp.packageId].push({
          id: bp.id,
          customerName: bp.customerName,
          startTime: bp.startTime,
        });
      });
      Object.keys(byPackage).forEach((packageId) => {
        byPackage[packageId].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      });
      setBookingsByPackage(byPackage);

      const list = (packageRes?.data?.records || []).sort(
        (a, b) => (a.params?.order ?? 0) - (b.params?.order ?? 0),
      );
      setRecords(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!records) return <div style={styles.loading}>Loading packages…</div>;

  function goToShow(id) {
    window.location.href = `${resource?.href || ""}/records/${id}/show`;
  }

  function goToBookingsForPackage(e, packageId) {
    e.stopPropagation();
    window.location.href = `/backoffice/resources/Booking?packageId=${packageId}`;
  }

  function clearFilters() {
    setServiceFilter("");
    setStatusFilter("all");
  }

  const filteredRecords = records.filter((r) => {
    const p = r.params || {};
    if (statusFilter !== "all") {
      const isActive = Boolean(p.active);
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
    }
    if (serviceFilter) {
      const serviceIds = readArrayParam(r, "services");
      if (!serviceIds.includes(serviceFilter)) return false;
    }
    return true;
  });

  const hasActiveFilter = !!serviceFilter || statusFilter !== "all";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Packages</h1>
          <div style={styles.subtitle}>
            {records.length} package{records.length === 1 ? "" : "s"}
          </div>
        </div>
        <a href={`${resource?.href || ""}/actions/new`} style={styles.addBtn}>
          + Add package
        </a>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Includes service</label>
          <select
            style={styles.filterSelect}
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="">All</option>
            {services.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Status</label>
          <select
            style={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {hasActiveFilter && (
          <button type="button" style={styles.clearFilter} onClick={clearFilters}>
            Clear filter
          </button>
        )}
      </div>

      {filteredRecords.length === 0 ? (
        <div style={styles.loading}>
          {hasActiveFilter ? "No packages match these filters." : "No packages yet."}
        </div>
      ) : (
        <div style={styles.list}>
          {filteredRecords.map((r) => {
            const p = r.params || {};
            const serviceIds = readArrayParam(r, "services");
            const serviceNames = serviceIds
              .map((id) => services.find((s) => s.value === id)?.label)
              .filter(Boolean);
            const packageBookings = bookingsByPackage[p.id] || [];
            const upcoming = packageBookings.filter((b) => isFutureBooking(b.startTime));
            const visibleBookings = upcoming.slice(0, 4);
            const extraCount = upcoming.length - visibleBookings.length;

            return (
              <div
                key={p.id}
                style={styles.card(isMobile)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                  e.currentTarget.style.borderColor = "#c9cedb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <span style={styles.rankBadge} title="Display order">
                  #{p.order ?? 0}
                </span>

                <div style={styles.mainClickable(isMobile)} onClick={() => goToShow(p.id)}>
                  <div style={styles.iconColumn}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.title} style={styles.avatar} />
                    ) : (
                      <div style={styles.avatarPlaceholder}>
                        {(p.title || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span style={styles.iconChip}>{formatPrice(p.offerPrice)}</span>
                    <span style={styles.iconChip}>{formatDuration(p.durationMinutes)}</span>
                  </div>
                  <div style={styles.body}>
                    <div style={styles.topRow}>
                      <span style={styles.name}>{p.title || "Untitled"}</span>
                      <span style={styles.statusBadge(p.active)}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                      {p.discountLabel && (
                        <span style={styles.discountBadge}>{p.discountLabel}</span>
                      )}
                    </div>
                    {p.description && (
                      <div style={styles.description}>
                        {p.description.length > 160
                          ? `${p.description.slice(0, 160)}…`
                          : p.description}
                      </div>
                    )}

                    {p.message && <div style={styles.message}>{p.message}</div>}

                    <div style={styles.sectionLabel}>Includes</div>
                    <div>
                      {serviceIds.length === 0 && (
                        <span style={styles.empty}>No services included</span>
                      )}
                      {serviceNames.map((name) => (
                        <span key={name} style={styles.chip}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  style={styles.panel(isMobile)}
                  onClick={(e) => goToBookingsForPackage(e, p.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f1f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fafbfc")}
                  title="View bookings for this package"
                >
                  <div style={styles.panelHeader}>
                    <span>Upcoming bookings</span>
                  </div>
                  {upcoming.length === 0 ? (
                    <div style={styles.panelEmpty}>No upcoming bookings</div>
                  ) : (
                    <>
                      {visibleBookings.map((b) => (
                        <div key={b.id} style={styles.bookingRow}>
                          <span style={styles.bookingCustomer}>{b.customerName || "No name"}</span>
                          <span style={styles.bookingDate}>{formatBookingDate(b.startTime)}</span>
                        </div>
                      ))}
                      {extraCount > 0 && <div style={styles.moreLink}>+{extraCount} more</div>}
                    </>
                  )}

                  <div style={styles.moreLink}>View all bookings →</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PackageCardList;
