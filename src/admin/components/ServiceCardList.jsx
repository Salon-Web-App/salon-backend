// components/ServiceCardList.jsx
//
// Full custom "list" page for the Service resource. Mirrors StaffCardList
// in size and weight: a vertically stacked list of cards, each with a
// main clickable area (icon, name, category, price/duration,
// description) and a right-side panel listing the staff members who
// offer the service (not just a count) — clicking that panel jumps to
// the Staff list pre-filtered to this service via ?serviceId=, the same
// query-param convention StaffCardList's "Today's Schedule" panel
// already uses for Booking (?staffId=).

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const MOBILE_BREAKPOINT = 768;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
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

  list: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  card: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "stretch",
    width: "100%",
    boxSizing: "border-box",
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
    width: "100%",
    boxSizing: "border-box",
    cursor: "pointer",
    color: "inherit",
    textDecoration: "none",
  }),
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
  category: { fontSize: 13, color: "#8892a6" },
  description: {
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
  chip: {
    display: "inline-block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
    color: "#1a1d24",
    fontWeight: 600,
  },
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
  staffRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 0",
    borderBottom: "1px solid #eceef2",
  },
  staffAvatar: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    objectFit: "cover",
    background: "#eef1f7",
    flexShrink: 0,
  },
  staffAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    color: "#8892a6",
    flexShrink: 0,
  },
  staffName: {
    fontSize: 12,
    color: "#1a1d24",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  panelEmpty: { fontSize: 12, color: "#b0b6c3", fontStyle: "italic" },
  moreLink: { fontSize: 11, color: "#4f46e5", fontWeight: 600, marginTop: 8 },
};

const ServiceCardList = (props) => {
  const { resource } = props;
  const [records, setRecords] = useState(null);
  const [staffByService, setStaffByService] = useState({});
  const [packagesByService, setPackagesByService] = useState({});
  // Tracks images that failed to load (broken/unreachable imageUrl) so we
  // can fall back to the initials placeholder instead of showing the
  // browser's broken-image glyph + overflowing alt text.
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.resourceAction({
        resourceId: "Service",
        actionName: "list",
        params: { perPage: 500 },
      }),
      api
        .resourceAction({
          resourceId: "Staff",
          actionName: "list",
          params: { perPage: 200 },
        })
        .catch(() => ({ data: { records: [] } })),
      api
        .resourceAction({
          resourceId: "Package",
          actionName: "list",
          params: { perPage: 500 },
        })
        .catch(() => ({ data: { records: [] } })),
    ]).then(([serviceRes, staffRes, packageRes]) => {
      if (cancelled) return;

      const byService = {};
      (staffRes?.data?.records || []).forEach((s) => {
        const ids = Array.isArray(s.params?.services) ? s.params.services : [];
        ids.forEach((id) => {
          if (!byService[id]) byService[id] = [];
          byService[id].push({
            id: s.params?.id,
            name: s.params?.name,
            photoUrl: s.params?.photoUrl,
          });
        });
      });

      const byPackage = {};
      (packageRes?.data?.records || []).forEach((pkg) => {
        const ids = Array.isArray(pkg.params?.services)
          ? pkg.params.services
          : [];
        ids.forEach((id) => {
          if (!byPackage[id]) byPackage[id] = [];
          byPackage[id].push(pkg.params?.title || "Untitled package");
        });
      });

      setRecords(serviceRes?.data?.records || []);
      setStaffByService(byService);
      setPackagesByService(byPackage);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!records) return <div style={styles.loading}>Loading services…</div>;

  function goToShow(id) {
    window.location.href = `${resource?.href || ""}/records/${id}/show`;
  }

  function goToStaffForService(e, serviceId) {
    e.stopPropagation();
    window.location.href = `/backoffice/resources/Staff?serviceId=${serviceId}`;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Services</h1>
          <div style={styles.subtitle}>
            {records.length} service{records.length === 1 ? "" : "s"}
          </div>
        </div>
        <a href={`${resource?.href || ""}/actions/new`} style={styles.addBtn}>
          + Add service
        </a>
      </div>

      {records.length === 0 ? (
        <div style={styles.loading}>No services yet.</div>
      ) : (
        <div style={styles.list}>
          {records.map((r) => {
            const p = r.params || {};
            const staffList = staffByService[p.id] || [];
            const visibleStaff = staffList.slice(0, 5);
            const extraCount = staffList.length - visibleStaff.length;
            const packageTitles = packagesByService[p.id] || [];

            return (
              <div
                key={p.id}
                style={styles.card(isMobile)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.06)";
                  e.currentTarget.style.borderColor = "#c9cedb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <div
                  style={styles.mainClickable(isMobile)}
                  onClick={() => goToShow(p.id)}
                >
                  <div style={styles.iconColumn}>
                    {p.imageUrl && !brokenImageIds.has(p.id) ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={styles.avatar}
                        onError={() =>
                          setBrokenImageIds(
                            (prev) => new Set(prev).add(p.id),
                          )
                        }
                      />
                    ) : (
                      <div style={styles.avatarPlaceholder}>
                        {(p.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span style={styles.iconChip}>{formatPrice(p.price)}</span>
                    <span style={styles.iconChip}>
                      {formatDuration(p.durationMinutes)}
                    </span>
                  </div>
                  <div style={styles.body}>
                    <div style={styles.topRow}>
                      <span style={styles.name}>{p.name || "Unnamed"}</span>
                      <span style={styles.statusBadge(p.active)}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {p.category && (
                      <div style={styles.category}>{p.category}</div>
                    )}
                    {p.description && (
                      <div style={styles.description}>{p.description}</div>
                    )}

                    <div style={styles.sectionLabel}>Included in packages</div>
                    <div>
                      {packageTitles.length === 0 ? (
                        <span style={styles.panelEmpty}>
                          Not part of any package
                        </span>
                      ) : (
                        packageTitles.map((title, i) => (
                          <span key={`${title}-${i}`} style={styles.chip}>
                            {title}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={styles.panel(isMobile)}
                  onClick={(e) => goToStaffForService(e, p.id)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f0f1f5")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#fafbfc")
                  }
                  title="View staff offering this service"
                >
                  <div style={styles.panelHeader}>
                    <span>Staff offering this</span>
                  </div>
                  {staffList.length === 0 ? (
                    <div style={styles.panelEmpty}>No staff assigned</div>
                  ) : (
                    <>
                      {visibleStaff.map((s) => (
                        <div key={s.id} style={styles.staffRow}>
                          {s.photoUrl ? (
                            <img
                              src={s.photoUrl}
                              alt={s.name}
                              style={styles.staffAvatar}
                            />
                          ) : (
                            <div style={styles.staffAvatarPlaceholder}>
                              {(s.name || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span style={styles.staffName}>
                            {s.name || "Unnamed"}
                          </span>
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div style={styles.moreLink}>+{extraCount} more</div>
                      )}
                      <div style={styles.moreLink}>View all staff →</div>
                    </>
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

export default ServiceCardList;
