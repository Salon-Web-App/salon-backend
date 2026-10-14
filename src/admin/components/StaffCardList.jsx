// components/StaffCardList.jsx

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

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

      return () => {
        mql.removeEventListener("change", handler);
      };
    }

    mql.addListener(handler);

    return () => {
      mql.removeListener(handler);
    };
  }, [query]);

  return isMobile;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function readServiceIds(record, propertyName) {
  const params = record?.params || {};

  if (Array.isArray(params[propertyName])) {
    return params[propertyName];
  }

  const idKeyPattern = new RegExp(`^${propertyName}\\.(\\d+)\\.id$`);

  const idEntries = Object.keys(params)
    .map((key) => {
      const match = key.match(idKeyPattern);

      return match
        ? {
            index: Number(match[1]),
            id: params[key],
          }
        : null;
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

function parseWorkingHoursValue(raw) {
  if (!raw) return {};

  if (typeof raw === "object") {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readWorkingHours(record) {
  const params = record?.params || {};

  if (params.workingHours) {
    return parseWorkingHoursValue(params.workingHours);
  }

  const prefix = "workingHours.";

  const result = {};

  Object.keys(params)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => {
      const rest = key.slice(prefix.length);

      const [day, idxStr] = rest.split(".");

      if (!day) return;

      if (!result[day]) {
        result[day] = [];
      }

      const idx = Number(idxStr);

      if (!Number.isNaN(idx)) {
        result[day][idx] = params[key];
      } else {
        result[day].push(params[key]);
      }
    });

  return result;
}

function to12Hour(time) {
  if (!time) return "";

  const [h, m] = time.split(":").map(Number);

  const period = h >= 12 ? "PM" : "AM";

  const hour12 = h % 12 === 0 ? 12 : h % 12;

  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatBookingTime(isoString) {
  if (!isoString) return "";

  const d = new Date(isoString);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBookingDate(isoString) {
  if (!isoString) return "";

  const d = new Date(isoString);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isToday(isoString) {
  if (!isoString) return false;

  const d = new Date(isoString);
  const now = new Date();

  if (Number.isNaN(d.getTime())) {
    return false;
  }

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isFutureBooking(isoString) {
  if (!isoString) return false;

  const d = new Date(isoString);
  const now = new Date();

  if (Number.isNaN(d.getTime())) {
    return false;
  }

  return d.getTime() > now.getTime();
}

function getServiceIdFilterFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("serviceId") || "";
}

function bookingLabel(bookingParams) {
  if (bookingParams.serviceName) {
    return bookingParams.serviceName;
  }

  if (bookingParams.packageTitle) {
    return bookingParams.packageTitle;
  }

  return "Booking";
}

// ------------------------------------------------------------
// Styles
// ------------------------------------------------------------

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
    minWidth: 160,
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

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  card: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "stretch",
    gap: 0,
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

  photo: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    objectFit: "cover",
    background: "#eef1f7",
    flexShrink: 0,
  },

  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 600,
    color: "#8892a6",
    flexShrink: 0,
  },

  body: {
    flex: 1,
    minWidth: 0,
  },

  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    flexWrap: "wrap",
  },

  name: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1d24",
  },

  specialty: {
    fontSize: 13,
    color: "#8892a6",
  },

  statusBadge: (active) => ({
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: active ? "#e6f6ec" : "#fdecec",
    color: active ? "#1d8a4c" : "#c0392b",
  }),

  experienceBadge: {
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: "#fff4e0",
    color: "#a6650a",
  },

  bio: {
    fontSize: 13,
    color: "#4b5061",
    lineHeight: 1.5,
    marginTop: 6,
    marginBottom: 10,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#b0b6c3",
    marginBottom: 6,
    marginTop: 10,
  },

  scheduleRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  dayPillOn: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
    background: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    cursor: "default",
  },

  dayPillOff: {
    fontSize: 11,
    fontWeight: 500,
    padding: "3px 8px",
    borderRadius: 6,
    background: "#f7f7f8",
    color: "#c3c8d3",
    border: "1px solid #eceef2",
    cursor: "default",
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

  empty: {
    color: "#b0b6c3",
    fontSize: 13,
    fontStyle: "italic",
  },

  loading: {
    color: "#8892a6",
    padding: 24,
    textAlign: "center",
  },

  // ----------------------------------------------------------
  // Booking side panel
  // ----------------------------------------------------------

  schedulePanel: (isMobile) => ({
    width: isMobile ? "auto" : 220,
    flexShrink: 0,

    borderLeft: isMobile ? "none" : "1px solid #eceef2",

    borderTop: isMobile ? "1px solid #eceef2" : "none",

    background: "#fafbfc",

    padding: isMobile ? "12px 14px 14px" : "16px 16px",

    cursor: "pointer",

    display: "flex",
    flexDirection: "column",

    transition: "background 0.15s",
  }),

  scheduleHeader: {
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

  scheduleCount: {
    background: "#4f46e5",
    color: "#fff",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 7px",
  },

  nextBookingDate: {
    fontSize: 10,
    fontWeight: 600,
    color: "#4f46e5",
    marginBottom: 4,
  },

  appointmentRow: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "row" : "column",

    alignItems: isMobile ? "baseline" : "stretch",

    gap: isMobile ? 8 : 0,

    padding: "6px 0",

    borderBottom: "1px solid #eceef2",
  }),

  appointmentTime: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1a1d24",
    flexShrink: 0,
  },

  appointmentService: (isMobile) => ({
    fontSize: 11,
    color: "#6b7280",

    marginTop: isMobile ? 0 : 1,

    minWidth: 0,

    overflow: "hidden",
    textOverflow: "ellipsis",

    whiteSpace: isMobile ? "nowrap" : "normal",
  }),

  noAppointments: {
    fontSize: 12,
    color: "#b0b6c3",
    fontStyle: "italic",
    padding: "8px 0",
  },

  moreLink: {
    fontSize: 11,
    color: "#4f46e5",
    fontWeight: 600,
    marginTop: 6,
  },
};

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

const StaffCardList = (props) => {
  const { resource } = props;

  const [records, setRecords] = useState(null);

  const [services, setServices] = useState(null);

  const [bookingsByStaff, setBookingsByStaff] = useState({});

  // --- Filters ---
  const [serviceFilter, setServiceFilter] = useState(getServiceIdFilterFromUrl());
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [experienceFilter, setExperienceFilter] = useState("all");

  const isMobile = useIsMobile();

  // ----------------------------------------------------------
  // Load staff / services / bookings / packages
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.resourceAction({
        resourceId: "Staff",
        actionName: "list",
        params: {
          perPage: 200,
        },
      }),

      api.resourceAction({
        resourceId: "Service",
        actionName: "list",
        params: {
          perPage: 500,
        },
      }),

      api
        .resourceAction({
          resourceId: "Booking",
          actionName: "list",
          params: {
            perPage: 1000,
          },
        })
        .catch(() => ({
          data: {
            records: [],
          },
        })),

      api
        .resourceAction({
          resourceId: "Package",
          actionName: "list",
          params: {
            perPage: 500,
          },
        })
        .catch(() => ({
          data: {
            records: [],
          },
        })),
    ]).then(([staffRes, serviceRes, bookingRes, packageRes]) => {
      if (cancelled) return;

      // ------------------------------------------------------
      // Services
      // ------------------------------------------------------

      const serviceList = (serviceRes?.data?.records || []).map((r) => ({
        value: r.id ?? r.params?.id,

        label: r.params?.name || r.title || `Service ${r.id}`,
      }));

      // ------------------------------------------------------
      // Packages
      // ------------------------------------------------------

      const packageList = (packageRes?.data?.records || []).map((r) => ({
        value: r.id ?? r.params?.id,

        label: r.params?.title || `Package ${r.id}`,
      }));

      // ------------------------------------------------------
      // Normalize bookings
      // ------------------------------------------------------

      const allBookings = (bookingRes?.data?.records || [])
        .map((b) => {
          const params = {
            ...(b.params || {}),
          };

          // AdminJS should normally provide this because
          // setupAdmin.js attaches it, but keep fallbacks
          // for flattened params.
          if (!params.staffId && params["staff.id"]) {
            params.staffId = params["staff.id"];
          }

          if (!params.serviceId && params["service.id"]) {
            params.serviceId = params["service.id"];
          }

          if (!params.packageId && params["package.id"]) {
            params.packageId = params["package.id"];
          }

          return params;
        })
        .filter((booking) => {
          // Must have a staff assignment.
          if (!booking.staffId) {
            return false;
          }

          // Ignore soft deleted bookings.
          if (booking.deletedAt) {
            return false;
          }

          // Ignore cancelled bookings.
          if (booking.status === "cancelled") {
            return false;
          }

          // Must have a valid start time.
          if (!booking.startTime) {
            return false;
          }

          const date = new Date(booking.startTime);

          if (Number.isNaN(date.getTime())) {
            return false;
          }

          return true;
        });

      // ------------------------------------------------------
      // Group bookings by staff
      //
      // IMPORTANT:
      //
      // We no longer throw away tomorrow/future bookings.
      // We keep all upcoming bookings so that if a staff member
      // has no booking today, we can show their next booking.
      // ------------------------------------------------------

      const grouped = {};

      allBookings.forEach((booking) => {
        const staffId = booking.staffId;

        if (!grouped[staffId]) {
          grouped[staffId] = [];
        }

        const serviceName = serviceList.find(
          (service) => service.value === booking.serviceId,
        )?.label;

        const packageTitle = packageList.find((pkg) => pkg.value === booking.packageId)?.label;

        grouped[staffId].push({
          ...booking,
          serviceName,
          packageTitle,
        });
      });

      // ------------------------------------------------------
      // Sort each staff member's bookings
      // ------------------------------------------------------

      Object.keys(grouped).forEach((staffId) => {
        grouped[staffId].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
      });

      setRecords(staffRes?.data?.records || []);

      setServices(serviceList);

      setBookingsByStaff(grouped);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------

  if (!records) {
    return <div style={styles.loading}>Loading staff…</div>;
  }

  // ----------------------------------------------------------
  // No staff
  // ----------------------------------------------------------

  if (records.length === 0) {
    return <div style={styles.loading}>No staff members yet.</div>;
  }

  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------

  function goToStaffShow(staffId) {
    window.location.href = `${resource?.href || ""}/records/${staffId}/show`;
  }

  function goToStaffBookings(e, staffId) {
    e.stopPropagation();

    window.location.href = `/backoffice/resources/Booking?staffId=${staffId}`;
  }

  function clearFilters() {
    setServiceFilter("");
    setStatusFilter("all");
    setExperienceFilter("all");
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  // ----------------------------------------------------------
  // Filtering
  // ----------------------------------------------------------

  const experienceOptions = Array.from(
    new Set(
      records
        .map((r) => r.params?.experience)
        .filter((exp) => exp !== undefined && exp !== null && exp !== ""),
    ),
  );

  const filteredRecords = records.filter((r) => {
    const params = r.params || {};

    if (statusFilter !== "all") {
      const isActive = Boolean(params.active);
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
    }

    if (experienceFilter !== "all" && params.experience !== experienceFilter) {
      return false;
    }

    if (serviceFilter) {
      const serviceIds = readServiceIds(r, "services");
      if (!serviceIds.includes(serviceFilter)) return false;
    }

    return true;
  });

  const filteredServiceName = serviceFilter
    ? services?.find((s) => s.value === serviceFilter)?.label || "this service"
    : null;

  const hasActiveFilter = !!serviceFilter || statusFilter !== "all" || experienceFilter !== "all";

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Staff</h1>
          <div style={styles.subtitle}>
            {serviceFilter
              ? `Showing staff offering ${filteredServiceName}`
              : `${records.length} staff member${records.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Service</label>
          <select
            style={styles.filterSelect}
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="">All</option>
            {(services || []).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Availability</label>
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

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Experience</label>
          <select
            style={styles.filterSelect}
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
          >
            <option value="all">All</option>
            {experienceOptions.map((exp) => (
              <option key={exp} value={exp}>
                {exp}
              </option>
            ))}
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
          {hasActiveFilter ? "No staff members match these filters." : "No staff members yet."}
        </div>
      ) : (
        <div style={styles.list}>
          {filteredRecords.map((r) => {
            const params = r.params || {};

            const serviceIds = readServiceIds(r, "services");

            const serviceNames = serviceIds
              .map((id) => services?.find((s) => s.value === id)?.label)
              .filter(Boolean);

            const schedule = readWorkingHours(r);

            // ------------------------------------------------------
            // Get all future bookings for this staff member
            // ------------------------------------------------------

            const staffBookings = (bookingsByStaff[params.id] || []).filter((booking) =>
              isFutureBooking(booking.startTime),
            );

            // ------------------------------------------------------
            // Today's bookings
            // ------------------------------------------------------

            const todaysBookings = staffBookings.filter((booking) => isToday(booking.startTime));

            // ------------------------------------------------------
            // Decide what to display
            //
            // If there are bookings today:
            //     show today's bookings
            //
            // Otherwise:
            //     show the next upcoming booking
            // ------------------------------------------------------

            const showingToday = todaysBookings.length > 0;

            const displayedBookings = showingToday
              ? todaysBookings
              : staffBookings.length > 0
                ? [staffBookings[0]]
                : [];

            const visibleAppointments = displayedBookings.slice(0, 4);

            const extraCount = showingToday
              ? todaysBookings.length - visibleAppointments.length
              : 0;

            const nextBooking =
              !showingToday && displayedBookings.length > 0 ? displayedBookings[0] : null;

            const initials = (params.name || "?")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={params.id}
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
                {/* ------------------------------------------------
                MAIN STAFF INFORMATION
            ------------------------------------------------ */}

                <div
                  style={styles.mainClickable(isMobile)}
                  onClick={() => goToStaffShow(params.id)}
                >
                  {params.photoUrl ? (
                    <img src={params.photoUrl} alt={params.name} style={styles.photo} />
                  ) : (
                    <div style={styles.photoPlaceholder}>{initials}</div>
                  )}

                  <div style={styles.body}>
                    <div style={styles.topRow}>
                      <span style={styles.name}>{params.name || "Unnamed staff"}</span>

                      <span style={styles.statusBadge(params.active)}>
                        {params.active ? "Active" : "Inactive"}
                      </span>

                      {params.experience && (
                        <span style={styles.experienceBadge}>
                          {params.experience} years of expertise
                        </span>
                      )}
                    </div>

                    {params.specialty && <div style={styles.specialty}>{params.specialty}</div>}

                    {params.bio && (
                      <div style={styles.bio}>
                        {params.bio.length > 160 ? `${params.bio.slice(0, 160)}…` : params.bio}
                      </div>
                    )}

                    {/* --------------------------------------------
                    WEEKLY SCHEDULE
                -------------------------------------------- */}

                    <div style={styles.sectionLabel}>Weekly schedule</div>

                    <div style={styles.scheduleRow}>
                      {DAYS.map((day) => {
                        const range = schedule?.[day.key]?.[0];

                        if (range) {
                          const [start, end] = range.split("-");

                          return (
                            <span
                              key={day.key}
                              style={styles.dayPillOn}
                              title={`${to12Hour(start)} – ${to12Hour(end)}`}
                            >
                              {day.label}
                            </span>
                          );
                        }

                        return (
                          <span key={day.key} style={styles.dayPillOff}>
                            {day.label}
                          </span>
                        );
                      })}
                    </div>

                    {/* --------------------------------------------
                    SERVICES
                -------------------------------------------- */}

                    <div style={styles.sectionLabel}>Services</div>

                    <div>
                      {serviceIds.length === 0 && (
                        <span style={styles.empty}>No services assigned</span>
                      )}

                      {serviceIds.length > 0 && !services && (
                        <span style={styles.empty}>Loading services…</span>
                      )}

                      {serviceIds.length > 0 &&
                        services &&
                        (serviceNames.length > 0 ? (
                          serviceNames.map((name) => (
                            <span key={name} style={styles.chip}>
                              {name}
                            </span>
                          ))
                        ) : (
                          <span style={styles.empty}>{serviceIds.length} service(s) assigned</span>
                        ))}
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------
                RIGHT SIDE BOOKING PANEL
            ------------------------------------------------ */}

                <div
                  style={styles.schedulePanel(isMobile)}
                  onClick={(e) => goToStaffBookings(e, params.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f1f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fafbfc")}
                  title={
                    showingToday
                      ? "View all bookings for this staff member"
                      : "View upcoming bookings for this staff member"
                  }
                >
                  {/* --------------------------------------------
                  HEADER
              -------------------------------------------- */}

                  <div style={styles.scheduleHeader}>
                    <span>{showingToday ? "Today's Schedule" : "Next Booking"}</span>

                    {showingToday && todaysBookings.length > 0 && (
                      <span style={styles.scheduleCount}>{todaysBookings.length}</span>
                    )}
                  </div>

                  {/* --------------------------------------------
                  NEXT BOOKING DATE
              -------------------------------------------- */}

                  {!showingToday && nextBooking && (
                    <div style={styles.nextBookingDate}>
                      {formatBookingDate(nextBooking.startTime)}
                    </div>
                  )}

                  {/* --------------------------------------------
                  NO BOOKINGS
              -------------------------------------------- */}

                  {displayedBookings.length === 0 && (
                    <div style={styles.noAppointments}>No upcoming bookings</div>
                  )}

                  {/* --------------------------------------------
                  BOOKINGS
              -------------------------------------------- */}

                  {visibleAppointments.map((booking, i) => (
                    <div
                      key={booking.id || `${booking.startTime}-${i}`}
                      style={styles.appointmentRow(isMobile)}
                    >
                      <span style={styles.appointmentTime}>
                        {formatBookingTime(booking.startTime)}
                      </span>

                      <span style={styles.appointmentService(isMobile)}>
                        {bookingLabel(booking)}
                      </span>
                    </div>
                  ))}

                  {/* --------------------------------------------
                  MORE TODAY
              -------------------------------------------- */}

                  {extraCount > 0 && <div style={styles.moreLink}>+{extraCount} more</div>}

                  {/* --------------------------------------------
                  FOOTER LINK
              -------------------------------------------- */}

                  {displayedBookings.length > 0 && (
                    <div style={styles.moreLink}>View all bookings →</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffCardList;
