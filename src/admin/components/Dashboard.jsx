// components/Dashboard.jsx
//
// Replaces AdminJS's default root/home page (wired via the `dashboard`
// option in setupAdmin.js). A global date-range filter (Today / This
// Week / This Month / This Year) scopes every metric block below it —
// stats, the trend chart, the bookings list, status breakdown, top
// services, and staff performance. Everything is computed client-side
// from data already available through the Staff, Service, Package, and
// Booking resources — no new backend endpoints.
//
// Booking.status only has real values of confirmed | staff_assigned |
// rescheduled | completed | cancelled (see prisma/schema.prisma) — there
// is no "no_show" status, so the status breakdown intentionally only
// shows the three categories that actually exist.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CHART_HEIGHT_PX = 140;

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function parseWorkingHoursValue(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getRangeBounds(rangeKey, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (rangeKey === "today") {
    return { start, end };
  }
  if (rangeKey === "week") {
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { start: weekStart, end: weekEnd };
  }
  if (rangeKey === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: monthStart, end: monthEnd };
  }
  // year
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start: yearStart, end: yearEnd };
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(d) {
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const styles = {
  page: { width: "100%", boxSizing: "border-box", padding: "0 20px 24px" },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  greeting: { fontSize: 22, fontWeight: 700, color: "#111827" },
  subGreeting: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  dateBadge: {
    fontSize: 13,
    color: "#4b5563",
    background: "#f3f4f6",
    padding: "6px 14px",
    borderRadius: 999,
    fontWeight: 600,
  },
  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  filterBtn: (active) => ({
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 999,
    border: active ? "1px solid #4f46e5" : "1px solid #e5e7eb",
    background: active ? "#4f46e5" : "#fff",
    color: active ? "#fff" : "#4b5563",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  }),
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "18px 20px",
    boxSizing: "border-box",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#9ca3af",
    marginBottom: 8,
  },
  statValue: { fontSize: 26, fontWeight: 700, color: "#111827" },
  grid2: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
    gap: 16,
    marginBottom: 16,
  },
  grid2b: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 16,
    marginBottom: 16,
  },
  panel: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    boxSizing: "border-box",
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#9ca3af",
    marginBottom: 16,
  },
  chartArea: {
    display: "flex",
    alignItems: "flex-end",
    gap: 6,
    height: CHART_HEIGHT_PX,
    overflowX: "auto",
  },
  chartBarWrap: {
    flex: "1 0 auto",
    minWidth: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    gap: 6,
  },
  chartValueLabel: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  chartBar: (heightPx) => ({
    width: "100%",
    maxWidth: 28,
    height: `${heightPx}px`,
    background: "linear-gradient(180deg, #6366f1, #4338ca)",
    borderRadius: "6px 6px 2px 2px",
  }),
  chartLabel: { fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" },
  chartLabelsRow: { display: "flex", gap: 6, marginTop: 6, overflowX: "auto" },
  chartLabelCell: { flex: "1 0 auto", minWidth: 28, textAlign: "center" },
  bookingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  bookingTime: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111827",
    width: 90,
    flexShrink: 0,
  },
  bookingService: { fontSize: 13, color: "#4b5563", flex: 1 },
  viewAllLink: {
    display: "block",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#4f46e5",
    marginTop: 12,
    textDecoration: "none",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
  },
  dot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  statusLabel: { fontSize: 13, color: "#4b5563", flex: 1 },
  statusCount: { fontSize: 14, fontWeight: 700, color: "#111827" },
  serviceRow: { marginBottom: 12 },
  serviceTopLine: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    marginBottom: 4,
  },
  serviceBarTrack: {
    background: "#f3f4f6",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  serviceBarFill: (pct) => ({
    width: `${pct}%`,
    height: "100%",
    background: "linear-gradient(90deg, #4f46e5, #6366f1)",
    borderRadius: 999,
  }),
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 480 },
  th: {
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "#9ca3af",
    padding: "0 0 10px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: "10px 0",
    fontSize: 13,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
  },
  empty: {
    color: "#9ca3af",
    fontSize: 13,
    fontStyle: "italic",
    padding: "12px 0",
  },
  loading: { color: "#9ca3af", padding: 40, textAlign: "center" },
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [range, setRange] = useState("today");

  useEffect(() => {
    Promise.all([
      api.resourceAction({
        resourceId: "Booking",
        actionName: "list",
        params: { perPage: 2000 },
      }),
      api.resourceAction({
        resourceId: "Staff",
        actionName: "list",
        params: { perPage: 500 },
      }),
      api.resourceAction({
        resourceId: "Service",
        actionName: "list",
        params: { perPage: 500 },
      }),
      api
        .resourceAction({
          resourceId: "Package",
          actionName: "list",
          params: { perPage: 500 },
        })
        .catch(() => ({ data: { records: [] } })),
    ]).then(([bookingRes, staffRes, serviceRes, packageRes]) => {
      setBookings((bookingRes?.data?.records || []).map((r) => r.params || {}));
      setStaff((staffRes?.data?.records || []).map((r) => r.params || {}));
      setServices((serviceRes?.data?.records || []).map((r) => r.params || {}));
      setPackages((packageRes?.data?.records || []).map((r) => r.params || {}));
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={styles.loading}>Loading dashboard…</div>;

  const now = new Date();
  const { start: rangeStart, end: rangeEnd } = getRangeBounds(range, now);
  const activeBookings = bookings.filter((b) => !b.deletedAt);

  function priceFor(b) {
    if (b.packageId) {
      const pkg = packages.find((p) => p.id === b.packageId);
      return pkg ? Number(pkg.offerPrice) : 0;
    }
    const svc = services.find((s) => s.id === b.serviceId);
    return svc ? Number(svc.price) : 0;
  }

  function serviceNameFor(b) {
    if (b.packageId) return packages.find((p) => p.id === b.packageId)?.title || "Package";
    return services.find((s) => s.id === b.serviceId)?.name || "Service";
  }

  const rangedBookings = activeBookings
    .filter((b) => {
      const t = new Date(b.startTime);
      return t >= rangeStart && t <= rangeEnd;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const nonCancelled = rangedBookings.filter((b) => b.status !== "cancelled");
  const totalRevenue = nonCancelled.reduce((sum, b) => sum + priceFor(b), 0);
  const uniqueCustomers = new Set(rangedBookings.map((b) => b.customerPhone)).size;

  const staffBookedIds = new Set(rangedBookings.filter((b) => b.staffId).map((b) => b.staffId));
  const activeStaffCount = staff.filter((s) => s.active).length;

  const completedCount = rangedBookings.filter((b) => b.status === "completed").length;
  const upcomingCount = rangedBookings.filter(
    (b) => b.status !== "completed" && b.status !== "cancelled",
  ).length;
  const cancelledCount = rangedBookings.filter((b) => b.status === "cancelled").length;

  // Trend chart buckets: hourly for Today, daily for Week/Month, monthly for Year.
  let chartBuckets = [];
  if (range === "today") {
    chartBuckets = Array.from({ length: 24 }).map((_, hour) => {
      const bucketBookings = nonCancelled.filter((b) => new Date(b.startTime).getHours() === hour);
      return {
        label: hour % 3 === 0 ? `${hour}:00` : "",
        total: bucketBookings.reduce((sum, b) => sum + priceFor(b), 0),
      };
    });
  } else if (range === "week" || range === "month") {
    const dayCount = Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
    chartBuckets = Array.from({ length: dayCount }).map((_, i) => {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + i);
      const bucketBookings = nonCancelled.filter((b) => isSameDay(new Date(b.startTime), day));
      return {
        label:
          range === "week"
            ? day.toLocaleDateString([], { weekday: "short" })
            : formatShortDate(day),
        total: bucketBookings.reduce((sum, b) => sum + priceFor(b), 0),
      };
    });
  } else {
    chartBuckets = Array.from({ length: 12 }).map((_, month) => {
      const bucketBookings = nonCancelled.filter((b) => new Date(b.startTime).getMonth() === month);
      return {
        label: new Date(now.getFullYear(), month, 1).toLocaleDateString([], {
          month: "short",
        }),
        total: bucketBookings.reduce((sum, b) => sum + priceFor(b), 0),
      };
    });
  }
  const maxBucketValue = Math.max(...chartBuckets.map((b) => b.total), 1);
  const barAvailablePx = CHART_HEIGHT_PX - 20;

  const serviceCounts = {};
  nonCancelled.forEach((b) => {
    const name = serviceNameFor(b);
    serviceCounts[name] = (serviceCounts[name] || 0) + 1;
  });
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxServiceCount = Math.max(...topServices.map(([, c]) => c), 1);

  const staffPerformance = staff
    .filter((s) => s.active)
    .map((s) => {
      const staffBookings = nonCancelled.filter((b) => b.staffId === s.id);
      const revenue = staffBookings.reduce((sum, b) => sum + priceFor(b), 0);

      // Utilization only has a clean single-day meaning — for week/month/year
      // ranges we show total booked hours instead of a % (a % would need to
      // sum working hours across every day in the range, which is a much
      // heavier computation for a dashboard glance-metric).
      let utilizationLabel = "—";
      if (range === "today") {
        const weekdayKey = DAY_KEYS[now.getDay()];
        const workingHours = parseWorkingHoursValue(s.workingHours);
        const rangeStr = workingHours?.[weekdayKey]?.[0];
        if (rangeStr) {
          const [wStart, wEnd] = rangeStr.split("-");
          const [sh, sm] = wStart.split(":").map(Number);
          const [eh, em] = wEnd.split(":").map(Number);
          const availableMinutes = eh * 60 + em - (sh * 60 + sm);
          const bookedMinutes = staffBookings.reduce((sum, b) => {
            const svc = services.find((sv) => sv.id === b.serviceId);
            const pkg = packages.find((p) => p.id === b.packageId);
            const duration = pkg?.durationMinutes ?? svc?.durationMinutes ?? 0;
            return sum + duration;
          }, 0);
          const pct =
            availableMinutes > 0
              ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100))
              : 0;
          utilizationLabel = `${pct}%`;
        } else {
          utilizationLabel = "Off today";
        }
      } else {
        const bookedMinutes = staffBookings.reduce((sum, b) => {
          const svc = services.find((sv) => sv.id === b.serviceId);
          const pkg = packages.find((p) => p.id === b.packageId);
          const duration = pkg?.durationMinutes ?? svc?.durationMinutes ?? 0;
          return sum + duration;
        }, 0);
        utilizationLabel = `${(bookedMinutes / 60).toFixed(1)}h booked`;
      }

      return {
        name: s.name,
        bookings: staffBookings.length,
        revenue,
        utilizationLabel,
      };
    })
    .sort((a, b) => b.bookings - a.bookings);

  const rangeLabel =
    range === "today"
      ? now.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : `${formatShortDate(rangeStart)} – ${formatShortDate(rangeEnd)}`;

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.greeting}>{greeting()}, Admin 👋</div>
          <div style={styles.subGreeting}>Here's what's happening at your salon.</div>
        </div>
        <div style={styles.dateBadge}>{rangeLabel}</div>
      </div>

      <div style={styles.filterRow}>
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            style={styles.filterBtn(range === opt.key)}
            onClick={() => setRange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Bookings</div>
          <div style={styles.statValue}>{rangedBookings.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Revenue</div>
          <div style={styles.statValue}>${totalRevenue.toFixed(0)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Customers</div>
          <div style={styles.statValue}>{uniqueCustomers}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            {range === "today" ? "Staff Scheduled" : "Staff Involved"}
          </div>
          <div style={styles.statValue}>
            {staffBookedIds.size}/{activeStaffCount}
          </div>
        </div>
      </div>

      <div style={styles.grid2}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Revenue Overview</div>
          <div style={styles.chartArea}>
            {chartBuckets.map((b, i) => {
              const barPx = Math.max(
                Math.round((b.total / maxBucketValue) * barAvailablePx),
                b.total > 0 ? 4 : 2,
              );
              return (
                <div key={i} style={styles.chartBarWrap}>
                  <div style={styles.chartValueLabel}>
                    {b.total > 0 ? `$${b.total.toFixed(0)}` : ""}
                  </div>
                  <div style={styles.chartBar(barPx)} />
                </div>
              );
            })}
          </div>
          <div style={styles.chartLabelsRow}>
            {chartBuckets.map((b, i) => (
              <div key={i} style={styles.chartLabelCell}>
                <span style={styles.chartLabel}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>
            {range === "today" ? "Today's Bookings" : "Recent Bookings"}
          </div>
          {rangedBookings.length === 0 && (
            <div style={styles.empty}>No bookings in this range.</div>
          )}
          {rangedBookings.slice(0, 6).map((b, i) => (
            <div key={i} style={styles.bookingRow}>
              <span style={styles.bookingTime}>
                {range === "today"
                  ? formatTime(b.startTime)
                  : formatShortDate(new Date(b.startTime))}
              </span>
              <span style={styles.bookingService}>{serviceNameFor(b)}</span>
            </div>
          ))}
          <a href="/backoffice/resources/Booking" style={styles.viewAllLink}>
            View all →
          </a>
        </div>
      </div>

      <div style={styles.grid2b}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Booking Status</div>
          <div style={styles.statusRow}>
            <span style={styles.dot("#15803d")} />
            <span style={styles.statusLabel}>Completed</span>
            <span style={styles.statusCount}>{completedCount}</span>
          </div>
          <div style={styles.statusRow}>
            <span style={styles.dot("#1d4ed8")} />
            <span style={styles.statusLabel}>Upcoming</span>
            <span style={styles.statusCount}>{upcomingCount}</span>
          </div>
          <div style={styles.statusRow}>
            <span style={styles.dot("#b91c1c")} />
            <span style={styles.statusLabel}>Cancelled</span>
            <span style={styles.statusCount}>{cancelledCount}</span>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Top Services</div>
          {topServices.length === 0 && (
            <div style={styles.empty}>No services booked in this range.</div>
          )}
          {topServices.map(([name, count]) => (
            <div key={name} style={styles.serviceRow}>
              <div style={styles.serviceTopLine}>
                <span>{name}</span>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </div>
              <div style={styles.serviceBarTrack}>
                <div style={styles.serviceBarFill((count / maxServiceCount) * 100)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Staff Performance</div>
        {staffPerformance.length === 0 && <div style={styles.empty}>No active staff.</div>}
        {staffPerformance.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Staff</th>
                  <th style={styles.th}>Bookings</th>
                  <th style={styles.th}>Revenue</th>
                  <th style={styles.th}>{range === "today" ? "Utilization" : "Booked Hours"}</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.map((s) => (
                  <tr key={s.name}>
                    <td style={styles.td}>{s.name}</td>
                    <td style={styles.td}>{s.bookings}</td>
                    <td style={styles.td}>${s.revenue.toFixed(0)}</td>
                    <td style={styles.td}>{s.utilizationLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
