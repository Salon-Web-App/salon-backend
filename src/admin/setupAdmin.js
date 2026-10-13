// AdminJS v7+ ships as ESM-only, but the rest of this backend is CommonJS.
// Rather than converting the whole project to ESM (which would break
// Express/Prisma interop and every other require() call), we load AdminJS's
// packages with a dynamic import() inside this one async function. That's
// the officially recommended way to consume an ESM-only package from CJS.
//
// This mounts a full CRUD UI (list/create/edit/delete + relations) over
// Staff, Service, Booking, BookingHistory, and Review — reusing the exact
// same Prisma models/tables as your hand-built /admin REST API. AdminUser
// itself is intentionally NOT exposed as a resource, so nobody can browse
// to a screen showing password hashes.
//
// Mounted at /backoffice (NOT /admin) because /admin is already used by
// your custom REST API routes in src/routes/admin/*.
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { enqueueNotification } = require("../jobs/queue");
const { uploadImageBuffer } = require("../lib/cloudinary");
const RedisStore = require("connect-redis").default;
const redis = require("../lib/redis");
const { cookieSecure } = require("../config");

// Same constant as src/controllers/admin/auth.controller.js — used only as
// a bcrypt.compare target for the "user not found" login path, never to
// actually authenticate anyone.
const DUMMY_ADMIN_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q/6yGa5eXeI5EofrOakYFdhaVwYbW";

async function bookingEditBefore(request) {
  if (request.method !== "post") return request;

  const bookingId = request.params.recordId;
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  if (!existing) return request;

  const historyEntries = [];
  let notifyType = null;
  const { payload } = request;

  if (payload.staffId && payload.staffId !== existing.staffId) {
    historyEntries.push({
      changeType: "staff_assigned",
      oldValue: existing.staffId,
      newValue: payload.staffId,
      changedBy: "admin",
    });
    notifyType = "booking.staff_assigned";
  }

  if (payload.startTime) {
    const newStart = new Date(payload.startTime);
    if (newStart.getTime() !== existing.startTime.getTime()) {
      const durationMs = existing.service.durationMinutes * 60 * 1000;
      payload.endTime = new Date(newStart.getTime() + durationMs).toISOString();
      historyEntries.push({
        changeType: "reschedule",
        oldValue: existing.startTime.toISOString(),
        newValue: newStart.toISOString(),
        changedBy: "admin",
      });
      notifyType = notifyType || "booking.rescheduled";
    }
  }

  if (payload.status && payload.status !== existing.status) {
    historyEntries.push({
      changeType: "status_change",
      oldValue: existing.status,
      newValue: payload.status,
      changedBy: "admin",
    });
    if (payload.status === "cancelled") notifyType = "booking.cancelled";
  }

  request.session = request.session || {};
  request._bookingChanges = { bookingId, historyEntries, notifyType };

  return request;
}

async function bookingEditAfter(response, request) {
  const changes = request._bookingChanges;
  if (!changes) return response;

  for (const entry of changes.historyEntries) {
    await prisma.bookingHistory.create({
      data: { bookingId: changes.bookingId, ...entry },
    });
  }
  if (changes.notifyType) {
    await enqueueNotification(changes.notifyType, {
      bookingId: changes.bookingId,
    });
  }

  return response;
}

// The custom WorkingHoursEdit component submits workingHours as a JSON
// string; Prisma's Json column needs an actual object. This converts it
// just before the record is written.
function parseWorkingHours(request) {
  const raw = request.payload?.workingHours;
  if (typeof raw === "string" && raw.trim()) {
    try {
      request.payload.workingHours = JSON.parse(raw);
    } catch (err) {
      throw new Error("Working Hours must be valid JSON.");
    }
  }
  return request;
}

// Detects a base64 data URL (set by PhotoUploadEdit when a new file is
// picked) and swaps it for a real Cloudinary URL before Prisma writes it.
// If the field is untouched (still a normal https:// URL, or empty), this
// is a no-op.
function makePhotoUploadHook(fieldName, folder) {
  return async function uploadPhotoIfNeeded(request) {
    const value = request.payload?.[fieldName];
    if (typeof value === "string" && value.startsWith("data:")) {
      const match = value.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (!match) {
        throw new Error("That file could not be read as an image.");
      }
      const buffer = Buffer.from(match[2], "base64");
      request.payload[fieldName] = await uploadImageBuffer(buffer, folder);
    }
    return request;
  };
}
function makeMediaUploadHook(fieldName, folder, resourceType = "auto") {
  return async function uploadMediaIfNeeded(request) {
    const value = request.payload?.[fieldName];
    if (typeof value === "string" && value.startsWith("data:")) {
      const match = value.match(
        /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
      );
      if (!match) throw new Error("That file could not be read.");
      const buffer = Buffer.from(match[2], "base64");
      request.payload[fieldName] = await uploadImageBuffer(
        buffer,
        folder,
        resourceType,
      );
    }
    return request;
  };
}
async function logAndNotify(
  bookingId,
  changeType,
  oldValue,
  newValue,
  notifyType,
) {
  await prisma.bookingHistory.create({
    data: { bookingId, changeType, oldValue, newValue, changedBy: "admin" },
  });
  if (notifyType) await enqueueNotification(notifyType, { bookingId });
}

// Prisma many-to-many relations (Staff <-> Service) aren't reliably
// written by @adminjs/prisma's generic update() — passing a raw array of
// ids for an isArray reference property often gets silently dropped
// instead of being translated into the `{ set: [...] }` syntax Prisma
// needs for relation writes. So we pull the submitted service ids out of
// the payload ourselves in `before`, strip them so AdminJS's default
// update doesn't choke on them, then apply the relation write directly
// via Prisma in `after`.
function extractServiceIds(request) {
  const raw = request.payload?.services;

  if (Array.isArray(raw)) return raw.filter(Boolean);

  // Fallback 1: flattened dot-notation form (services.0, services.1, ...)
  const dotKeys = Object.keys(request.payload || {})
    .filter((key) => key.startsWith("services."))
    .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))
    .map((key) => request.payload[key])
    .filter(Boolean);
  if (dotKeys.length) return dotKeys;

  // Fallback 2: comma-joined string (can happen if an array value gets
  // coerced through FormData.append, which calls toString() on it).
  if (typeof raw === "string" && raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return undefined; // field wasn't touched in this submission
}

function stripServicesFromPayload(request) {
  if (!request.payload) return;
  delete request.payload.services;
  Object.keys(request.payload).forEach((key) => {
    if (key.startsWith("services.")) delete request.payload[key];
  });
}

async function staffEditBefore(request) {
  if (request.method !== "post") return request;
  request._staffServiceIds = extractServiceIds(request);
  stripServicesFromPayload(request);
  return request;
}

async function staffEditAfter(response, request) {
  const serviceIds = request._staffServiceIds;
  if (serviceIds === undefined) return response; // field wasn't submitted, leave relation untouched
  const staffId = response?.record?.params?.id;
  if (!staffId) return response;

  await prisma.staff.update({
    where: { id: staffId },
    data: { services: { set: serviceIds.map((id) => ({ id })) } },
  });

  return response;
}

// @adminjs/prisma's default list/show/edit queries don't include the
// Staff<->Service many-to-many relation, so record.params.services is
// simply absent — not empty, not oddly-shaped, just never fetched. We
// pull it ourselves and attach it as a plain array of ids, which is the
// shape ServicesEdit/ServicesList already expect.
async function attachStaffServices(records) {
  const staffIds = records.map((r) => r.params?.id).filter(Boolean);
  if (!staffIds.length) return records;

  const rows = await prisma.staff.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, services: { select: { id: true } } },
  });
  const byStaffId = new Map(
    rows.map((s) => [s.id, s.services.map((svc) => svc.id)]),
  );

  records.forEach((r) => {
    if (r.params) {
      r.params.services = byStaffId.get(r.params.id) || [];
    }
  });

  return records;
}

async function staffListAfter(response) {
  if (Array.isArray(response?.records)) {
    await attachStaffServices(response.records);
  }
  return response;
}

async function staffRecordAfter(response) {
  if (response?.record) {
    await attachStaffServices([response.record]);
  }
  return response;
}

// staffId / serviceId are the scalar FK columns behind Booking's `staff`
// and `service` Prisma relations. @adminjs/prisma does not reliably keep
// those raw FK columns in a record's serialized params once a relation is
// defined over them (visible as "[AdminJS]: There is no property of the
// name: 'staffId'" in the server log) — declaring them under
// options.properties does NOT fix this, since the property-driven
// serialization step still runs first and drops them before any override
// is applied. So, same as attachStaffServices above, we re-fetch the raw
// columns straight from Prisma and attach them onto record.params
// directly, after AdminJS has already built its response — this bypasses
// the property system entirely and is the same trick already used for
// the Staff<->Service many-to-many relation.
//
// IMPORTANT: these are only useful if actually wired into an action's
// `after` array below. Defining them here does nothing on their own —
// that was the actual bug: the functions existed but no action ever
// called them.
async function attachBookingIds(records) {
  const bookingIds = records.map((r) => r.params?.id).filter(Boolean);
  if (!bookingIds.length) return records;

  const rows = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    select: { id: true, staffId: true, serviceId: true, packageId: true },
  });
  const byId = new Map(rows.map((b) => [b.id, b]));

  records.forEach((r) => {
    if (!r.params) return;
    const row = byId.get(r.params.id);
    if (row) {
      r.params.staffId = row.staffId;
      r.params.serviceId = row.serviceId;
      r.params.packageId = row.packageId;
    }
  });

  return records;
}

async function bookingListAfter(response) {
  if (Array.isArray(response?.records)) {
    await attachBookingIds(response.records);
  }
  return response;
}

async function bookingRecordAfter(response) {
  if (response?.record) {
    await attachBookingIds([response.record]);
  }
  return response;
}

// Same many-to-many write problem as Staff<->Service (see extractServiceIds
// above, which this reuses as-is since it only reads request.payload.services
// regardless of which resource is submitting it), but for Package<->Service.
async function attachPackageServices(records) {
  const packageIds = records.map((r) => r.params?.id).filter(Boolean);
  if (!packageIds.length) return records;

  const rows = await prisma.package.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, services: { select: { id: true } } },
  });
  const byPackageId = new Map(
    rows.map((p) => [p.id, p.services.map((svc) => svc.id)]),
  );

  records.forEach((r) => {
    if (r.params) {
      r.params.services = byPackageId.get(r.params.id) || [];
    }
  });

  return records;
}

async function packageListAfter(response) {
  if (Array.isArray(response?.records)) {
    await attachPackageServices(response.records);
  }
  return response;
}

async function packageRecordAfter(response) {
  if (response?.record) {
    await attachPackageServices([response.record]);
  }
  return response;
}

async function packageEditBefore(request) {
  if (request.method !== "post") return request;
  request._packageServiceIds = extractServiceIds(request);
  stripServicesFromPayload(request);
  return request;
}

async function packageEditAfter(response, request) {
  const serviceIds = request._packageServiceIds;
  if (serviceIds === undefined) return response;
  const packageId = response?.record?.params?.id;
  if (!packageId) return response;

  await prisma.package.update({
    where: { id: packageId },
    data: { services: { set: serviceIds.map((id) => ({ id })) } },
  });

  return response;
}

// Reviews are never hand-edited (rating/comment/booking all come from the
// customer) — the only two things an admin can change are display order
// and public visibility, both exposed as hidden record actions called
// directly from ReviewCardList/ReviewShow rather than a generic edit form.
async function reviewReorderHandler(request, response, context) {
  const { record, currentAdmin, resource } = context;
  const direction = request.payload?.direction;
  if (direction !== "up" && direction !== "down") {
    throw new Error("direction must be 'up' or 'down'");
  }

  const all = await prisma.review.findMany({ orderBy: { order: "asc" } });
  const index = all.findIndex((r) => r.id === record.id());
  if (index === -1) throw new Error("Review not found");

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= all.length) {
    // Already at the edge — nothing to do.
    const updated = await resource.findOne(record.id());
    return { record: updated.toJSON(currentAdmin) };
  }

  const current = all[index];
  const neighbor = all[neighborIndex];

  await prisma.$transaction([
    prisma.review.update({
      where: { id: current.id },
      data: { order: neighbor.order },
    }),
    prisma.review.update({
      where: { id: neighbor.id },
      data: { order: current.order },
    }),
  ]);

  const updated = await resource.findOne(record.id());
  return { record: updated.toJSON(currentAdmin) };
}

async function reviewToggleVisibilityHandler(request, response, context) {
  const { record, currentAdmin, resource } = context;
  const approved = Boolean(request.payload?.approved);
  await prisma.review.update({
    where: { id: record.id() },
    data: { approved },
  });
  const updated = await resource.findOne(record.id());
  return { record: updated.toJSON(currentAdmin) };
}

// A completed booking is done — the customer has already had their
// appointment, so nothing about it should be changeable through the admin
// panel anymore (no reassign, reschedule, cancel, or delete). This is
// checked server-side, not just hidden in the UI, so the restriction
// holds even if someone calls the action directly.
function assertBookingEditable(existing) {
  if (existing?.status === "completed") {
    throw new Error("This booking is completed and can no longer be changed.");
  }
}

async function mountAdminPanel(app) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set. Add it to your .env file (any long random string) before starting the server.",
    );
  }

  const { default: AdminJS, ComponentLoader } = await import("adminjs");
  const { default: AdminJSExpress } = await import("@adminjs/express");
  const { Database, Resource, getModelByName } =
    await import("@adminjs/prisma");

  AdminJS.registerAdapter({ Database, Resource });

  const componentLoader = new ComponentLoader();
  const Components = {
    WorkingHoursEdit: componentLoader.add(
      "WorkingHoursEdit",
      require.resolve("./components/WorkingHoursEdit.jsx"),
    ),
    PhotoUploadEdit: componentLoader.add(
      "PhotoUploadEdit",
      require.resolve("./components/PhotoUploadEdit.jsx"),
    ),
    ServicesEdit: componentLoader.add(
      "ServicesEdit",
      require.resolve("./components/ServiceEdit.jsx"),
    ),
    StaffShow: componentLoader.add(
      "StaffShow",
      require.resolve("./components/StaffShow.jsx"),
    ),
    StaffEdit: componentLoader.add(
      "StaffEdit",
      require.resolve("./components/StaffEdit.jsx"),
    ),
    StaffCardList: componentLoader.add(
      "StaffCardList",
      require.resolve("./components/StaffCardList.jsx"),
    ),
    // Booking list, show, and edit now follow the same card/profile
    // design language as the Staff pages above. BookingGrid.jsx (the old
    // table-style grid) has been replaced by BookingCardList.jsx.
    BookingCardList: componentLoader.add(
      "BookingCardList",
      require.resolve("./components/BookingCardList.jsx"),
    ),
    BookingShow: componentLoader.add(
      "BookingShow",
      require.resolve("./components/BookingShow.jsx"),
    ),
    // Service, Package, BookingHistory, Review, and Transformation now
    // follow the same card/profile design language as Staff and Booking.
    ServiceCardList: componentLoader.add(
      "ServiceCardList",
      require.resolve("./components/ServiceCardList.jsx"),
    ),
    ServiceShow: componentLoader.add(
      "ServiceShow",
      require.resolve("./components/ServiceShow.jsx"),
    ),
    ServiceEdit: componentLoader.add(
      "ServiceEdit",
      require.resolve("./components/ServiceEdit.jsx"),
    ),
    PackageCardList: componentLoader.add(
      "PackageCardList",
      require.resolve("./components/PackageCardList.jsx"),
    ),
    PackageShow: componentLoader.add(
      "PackageShow",
      require.resolve("./components/PackageShow.jsx"),
    ),
    PackageEdit: componentLoader.add(
      "PackageEdit",
      require.resolve("./components/PackageEdit.jsx"),
    ),
    BookingHistoryCardList: componentLoader.add(
      "BookingHistoryCardList",
      require.resolve("./components/BookingHistoryCardList.jsx"),
    ),
    BookingHistoryShow: componentLoader.add(
      "BookingHistoryShow",
      require.resolve("./components/BookingHistoryShow.jsx"),
    ),
    ReviewCardList: componentLoader.add(
      "ReviewCardList",
      require.resolve("./components/ReviewCardList.jsx"),
    ),
    ReviewShow: componentLoader.add(
      "ReviewShow",
      require.resolve("./components/ReviewShow.jsx"),
    ),
    TransformationCardList: componentLoader.add(
      "TransformationCardList",
      require.resolve("./components/TransformationCardList.jsx"),
    ),
    TransformationShow: componentLoader.add(
      "TransformationShow",
      require.resolve("./components/TransformationShow.jsx"),
    ),
    TransformationEdit: componentLoader.add(
      "TransformationEdit",
      require.resolve("./components/TransformationEdit.jsx"),
    ),
    Dashboard: componentLoader.add(
      "Dashboard",
      require.resolve("./components/Dashboard.jsx"),
    ),
  };

  const admin = new AdminJS({
    rootPath: "/backoffice",
    loginPath: "/backoffice/login",
    logoutPath: "/backoffice/logout",
    branding: { companyName: "Makeup Studio — Backoffice" },
    dashboard: { component: Components.Dashboard },
    // Blanks out the "Navigation" heading AdminJS renders above the
    // sidebar's resource list — pure UI chrome text, unrelated to the
    // per-resource `navigation` option above.
    locale: {
      language: "en",
      translations: { en: { labels: { navigation: "" } } },
    },
    componentLoader,
    resources: [
      {
        resource: {
          model: getModelByName("Staff"),
          client: prisma,
        },

        options: {
          // Ungroups this resource from the sidebar's default "prisma"
          // dropdown so it appears as a flat top-level nav item.
          navigation: null,
          properties: {
            workingHours: {
              components: {
                edit: Components.WorkingHoursEdit,
              },
            },

            photoUrl: {
              components: {
                edit: Components.PhotoUploadEdit,
              },
            },

            services: {
              reference: "Service",
              // isArray must stay true — @adminjs/prisma relies on this
              // to translate edits into a proper connect/set operation
              // on the Staff<->Service many-to-many relation table.
              isArray: true,
              components: {
                edit: Components.ServicesEdit,
                list: Components.ServicesList,
                show: Components.ServicesList,
              },
            },
          },

          actions: {
            list: {
              after: [staffListAfter],
              component: Components.StaffCardList,
              showFilter: false,
            },
            show: {
              after: [staffRecordAfter],
              component: Components.StaffShow,
            },

            new: {
              before: [
                parseWorkingHours,
                makePhotoUploadHook("photoUrl", "staff"),
                staffEditBefore,
              ],
              after: [staffEditAfter, staffRecordAfter],
              component: Components.StaffEdit,
            },

            edit: {
              before: [
                parseWorkingHours,
                makePhotoUploadHook("photoUrl", "staff"),
                staffEditBefore,
              ],
              after: [staffEditAfter, staffRecordAfter],
              component: Components.StaffEdit,
            },
          },
        },
      },
      {
        resource: { model: getModelByName("Service"), client: prisma },
        options: {
          navigation: null,
          properties: {
            imageUrl: { components: { edit: Components.PhotoUploadEdit } },
            icon: {
              availableValues: [
                { value: "crown", label: "Crown (Bridal)" },
                { value: "sparkles", label: "Sparkles (Facial/Skin)" },
                { value: "scissors", label: "Scissors (Hair Cut)" },
                { value: "palette", label: "Palette (Makeup)" },
                { value: "hand", label: "Hand (Nails)" },
                { value: "heart", label: "Heart (Body/Spa)" },
                { value: "eye", label: "Eye (Lash/Brow)" },
                { value: "droplet", label: "Droplet (Hair Treatment)" },
              ],
            },
          },
          actions: {
            // showFilter:false — AdminJS reserves a persistent filter
            // sidebar for resources with enum-style properties (icon's
            // availableValues here), which narrows our fully-custom list
            // component's available width. We build our own filters
            // in-component where needed, so this stays off everywhere.
            list: { component: Components.ServiceCardList, showFilter: false },
            show: { component: Components.ServiceShow },
            new: {
              before: [makePhotoUploadHook("imageUrl", "services")],
              component: Components.ServiceEdit,
            },
            edit: {
              before: [makePhotoUploadHook("imageUrl", "services")],
              component: Components.ServiceEdit,
            },
          },
        },
      },
      {
        resource: { model: getModelByName("Booking"), client: prisma },
        options: {
          navigation: null,
          // NOTE: declaring staffId/serviceId under `properties` here does
          // NOT make @adminjs/prisma include them in record.params — the
          // property-driven serialization step runs first and drops them
          // regardless of any override, so there is intentionally no
          // `properties` block for this resource. The fix is the
          // attachBookingIds "after" hooks wired into every action below,
          // which write the raw values onto record.params directly, after
          // AdminJS has already built (and mangled) its own response.
          showProperties: [
            "applicationId",
            "customerName",
            "customerPhone",
            "customerEmail",
            "phoneVerified",
            "emailVerified",
            "serviceId",
            "staffId",
            "startTime",
            "endTime",
            "status",
            "deletedAt",
            "createdAt",
            "updatedAt",
          ],
          actions: {
            // These `after: [...]` entries are the actual fix — without
            // them, attachBookingIds/bookingListAfter/bookingRecordAfter
            // are defined but never called, and staffId/serviceId never
            // reach the frontend no matter what the component code does.
            list: {
              after: [bookingListAfter],
              component: Components.BookingCardList,
              showFilter: false,
            },
            show: {
              after: [bookingRecordAfter],
              component: Components.BookingShow,
            },

            // Editing is intentionally not exposed for Booking — all
            // changes go through the dedicated actions below (reassign,
            // reschedule, cancel) so each one is logged to BookingHistory
            // and triggers the right customer notification. A generic
            // edit form would let fields change silently.
            new: { isVisible: false },
            edit: { isVisible: false },

            delete: {
              // isVisible only hides it from AdminJS's default action
              // toolbar — the action itself is still reachable, which is
              // how the Delete button inside BookingShow/BookingCardList
              // keeps working. Without this, AdminJS renders its own
              // "Delete" toolbar button on top of our custom one.
              isVisible: false,
              guard:
                "This will hide the booking from normal views but keep its history. Continue?",
              handler: async (request, response, context) => {
                const { record, currentAdmin } = context;
                const existing = await prisma.booking.findUnique({
                  where: { id: record.id() },
                });
                assertBookingEditable(existing);
                await logAndNotify(
                  record.id(),
                  "soft_deleted",
                  existing.status,
                  "deleted",
                  null,
                );
                await prisma.booking.update({
                  where: { id: record.id() },
                  data: { deletedAt: new Date() },
                });
                return { record: record.toJSON(currentAdmin) };
              },
            },
            reassignStaff: {
              actionType: "record",
              component: false,
              // Hidden from AdminJS's default toolbar — called directly
              // via api.recordAction() from the Reassign panel inside
              // BookingShow / BookingCardList.
              isVisible: false,
              after: [bookingRecordAfter],
              handler: async (request, response, context) => {
                const { record, currentAdmin, resource } = context;
                const staffId = request.payload?.staffId;
                if (!staffId) throw new Error("staffId is required");
                const existing = await prisma.booking.findUnique({
                  where: { id: record.id() },
                });
                assertBookingEditable(existing);
                await prisma.booking.update({
                  where: { id: record.id() },
                  data: { staffId, status: "staff_assigned" },
                });
                await logAndNotify(
                  record.id(),
                  "staff_assigned",
                  existing.staffId,
                  staffId,
                  "booking.staff_assigned",
                );
                const updated = await resource.findOne(record.id());
                return { record: updated.toJSON(currentAdmin) };
              },
            },
            reschedule: {
              actionType: "record",
              component: false,
              // Hidden from AdminJS's default toolbar — called directly
              // via api.recordAction() from the Reschedule panel inside
              // BookingShow / BookingCardList.
              isVisible: false,
              after: [bookingRecordAfter],
              handler: async (request, response, context) => {
                const { record, currentAdmin, resource } = context;
                const startTime = request.payload?.startTime;
                if (!startTime) throw new Error("startTime is required");
                const existing = await prisma.booking.findUnique({
                  where: { id: record.id() },
                  include: { service: true },
                });
                assertBookingEditable(existing);
                const newStart = new Date(startTime);
                const newEnd = new Date(
                  newStart.getTime() +
                    existing.service.durationMinutes * 60 * 1000,
                );
                await prisma.booking.update({
                  where: { id: record.id() },
                  data: {
                    startTime: newStart,
                    endTime: newEnd,
                    status: "rescheduled",
                  },
                });
                await logAndNotify(
                  record.id(),
                  "reschedule",
                  existing.startTime.toISOString(),
                  newStart.toISOString(),
                  "booking.rescheduled",
                );
                const updated = await resource.findOne(record.id());
                return { record: updated.toJSON(currentAdmin) };
              },
            },
            cancelBooking: {
              actionType: "record",
              component: false,
              // Hidden from AdminJS's default toolbar — called directly
              // via api.recordAction() from the Cancel button inside
              // BookingShow / BookingCardList.
              isVisible: false,
              after: [bookingRecordAfter],
              handler: async (request, response, context) => {
                const { record, currentAdmin, resource } = context;
                const existing = await prisma.booking.findUnique({
                  where: { id: record.id() },
                });
                assertBookingEditable(existing);
                await prisma.booking.update({
                  where: { id: record.id() },
                  data: { status: "cancelled" },
                });
                await logAndNotify(
                  record.id(),
                  "status_change",
                  existing.status,
                  "cancelled",
                  "booking.cancelled",
                );
                const updated = await resource.findOne(record.id());
                return { record: updated.toJSON(currentAdmin) };
              },
            },
          },
        },
      },
      {
        resource: { model: getModelByName("Package"), client: prisma },
        options: {
          navigation: null,
          properties: {
            imageUrl: { components: { edit: Components.PhotoUploadEdit } },
            services: {
              reference: "Service",
              // isArray must stay true — same reasoning as Staff.services.
              isArray: true,
            },
          },
          actions: {
            list: {
              after: [packageListAfter],
              component: Components.PackageCardList,
              showFilter: false,
            },
            show: {
              after: [packageRecordAfter],
              component: Components.PackageShow,
            },
            new: {
              before: [
                makePhotoUploadHook("imageUrl", "packages"),
                packageEditBefore,
              ],
              after: [packageEditAfter, packageRecordAfter],
              component: Components.PackageEdit,
            },
            edit: {
              before: [
                makePhotoUploadHook("imageUrl", "packages"),
                packageEditBefore,
              ],
              after: [packageEditAfter, packageRecordAfter],
              component: Components.PackageEdit,
            },
          },
        },
      },
      // {
      //   resource: { model: getModelByName("BookingHistory"), client: prisma },
      //   options: {
      //     navigation: null,
      //     // Audit log — view only, never hand-edited.
      //     actions: {
      //       list: {
      //         component: Components.BookingHistoryCardList,
      //         showFilter: false,
      //       },
      //       show: { component: Components.BookingHistoryShow },
      //       new: { isVisible: false },
      //       edit: { isVisible: false },
      //       delete: { isVisible: false },
      //     },
      //   },
      // },
      {
        resource: { model: getModelByName("Transformation"), client: prisma },
        options: {
          navigation: null,
          properties: {
            beforeUrl: { components: { edit: Components.PhotoUploadEdit } },
            afterUrl: { components: { edit: Components.PhotoUploadEdit } },
          },
          actions: {
            list: {
              component: Components.TransformationCardList,
              showFilter: false,
            },
            show: { component: Components.TransformationShow },
            new: {
              before: [
                makePhotoUploadHook("beforeUrl", "transformations"),
                makePhotoUploadHook("afterUrl", "transformations"),
              ],
              component: Components.TransformationEdit,
            },
            edit: {
              before: [
                makePhotoUploadHook("beforeUrl", "transformations"),
                makePhotoUploadHook("afterUrl", "transformations"),
              ],
              component: Components.TransformationEdit,
            },
          },
        },
      },
      {
        resource: { model: getModelByName("Review"), client: prisma },
        options: {
          navigation: null,
          actions: {
            list: { component: Components.ReviewCardList, showFilter: false },
            show: { component: Components.ReviewShow },
            // Reviews are never hand-edited — rating/comment/booking are
            // all set by the customer. Only order and visibility can
            // change, via the two hidden actions below.
            new: { isVisible: false },
            edit: { isVisible: false },
            reorder: {
              actionType: "record",
              component: false,
              isVisible: false,
              handler: reviewReorderHandler,
            },
            toggleVisibility: {
              actionType: "record",
              component: false,
              isVisible: false,
              handler: reviewToggleVisibilityHandler,
            },
          },
        },
      },
    ],
  });

  // AdminJS doesn't bundle custom components just because they're in the
  // ComponentLoader — you have to explicitly kick off bundling. In dev,
  // watch() bundles once and rebuilds on file changes; in prod, initialize()
  // bundles once at boot. Skipping this is what causes:
  //   "Component X has not been bundled, ensure it was added to your
  //    ComponentLoader instance"
  if (process.env.NODE_ENV === "production") {
    await admin.initialize();
  } else {
    await admin.watch();
  }

  // Logs in against the same AdminUser table / bcrypt hash used by your
  // POST /admin/auth/login endpoint — one set of admin credentials for both.
  const authenticate = async (email, password) => {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    // Always run bcrypt.compare, even when the user doesn't exist — against
    // a fixed dummy hash in that case — so a nonexistent email doesn't
    // resolve faster than a real one and leak which admin emails exist via
    // response timing.
    const valid = await bcrypt.compare(
      password,
      user?.passwordHash || DUMMY_ADMIN_HASH,
    );
    return user && valid ? { email: user.email, id: user.id } : null;
  };

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: process.env.ADMIN_SESSION_SECRET,
    },
    null, // no pre-built router — let AdminJSExpress create one
    {
      // express-session options. Sessions live in Redis so every
      // backend task/replica sees the same login — an in-memory store
      // would log the admin out whenever a request hit another task.
      store: new RedisStore({ client: redis, prefix: "salon:sess:" }),
      name: "salon.sid",
      proxy: true, // trust X-Forwarded-Proto from the ALB/nginx for secure cookies
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_SESSION_SECRET,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure, // false locally (http), true in ECS (https via ALB)
      },
    },
  );

  app.use(admin.options.rootPath, adminRouter);
}

module.exports = { mountAdminPanel };
