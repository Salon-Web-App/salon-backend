// AdminJS v7 is ESM-only; the rest of the backend is CommonJS, so AdminJS
// packages are loaded with dynamic import() inside mountAdminPanel.
//
// Mounted at /backoffice. AdminUser is deliberately not exposed as a
// resource so password hashes never appear in the UI.
const bcrypt = require("bcryptjs");
const RedisStore = require("connect-redis").default;
const prisma = require("../lib/prisma");
const redis = require("../lib/redis");
const { cookieSecure } = require("../config");
const { enqueueNotification } = require("../jobs/queue");
const { uploadImageBuffer } = require("../lib/cloudinary");

// Compared against when the email doesn't exist, so unknown emails take as
// long as wrong passwords and can't be enumerated by timing.
const DUMMY_ADMIN_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8Q/6yGa5eXeI5EofrOakYFdhaVwYbW";

// WorkingHoursEdit submits JSON as a string; the Prisma Json column needs an object.
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

// PhotoUploadEdit sends a base64 data URL for a newly picked file; swap it
// for a Cloudinary URL before the record is written.
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

async function logAndNotify(bookingId, changeType, oldValue, newValue, notifyType) {
  await prisma.bookingHistory.create({
    data: { bookingId, changeType, oldValue, newValue, changedBy: "admin" },
  });
  if (notifyType) await enqueueNotification(notifyType, { bookingId });
}

// @adminjs/prisma doesn't reliably write many-to-many relations, so service
// ids are pulled out of the payload in `before` and written with Prisma in
// `after`. Used by both Staff and Package.
function extractServiceIds(request) {
  const raw = request.payload?.services;

  if (Array.isArray(raw)) return raw.filter(Boolean);

  // Flattened form: services.0, services.1, ...
  const dotKeys = Object.keys(request.payload || {})
    .filter((key) => key.startsWith("services."))
    .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))
    .map((key) => request.payload[key])
    .filter(Boolean);
  if (dotKeys.length) return dotKeys;

  // FormData.append stringifies arrays to "a,b,c".
  if (typeof raw === "string" && raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return undefined; // field not submitted
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
  if (serviceIds === undefined) return response;
  const staffId = response?.record?.params?.id;
  if (!staffId) return response;

  await prisma.staff.update({
    where: { id: staffId },
    data: { services: { set: serviceIds.map((id) => ({ id })) } },
  });

  return response;
}

// The default queries don't load the Staff<->Service relation, so attach the
// ids for the custom components.
async function attachStaffServices(records) {
  const staffIds = records.map((r) => r.params?.id).filter(Boolean);
  if (!staffIds.length) return records;

  const rows = await prisma.staff.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, services: { select: { id: true } } },
  });
  const byStaffId = new Map(rows.map((s) => [s.id, s.services.map((svc) => svc.id)]));

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

// @adminjs/prisma drops scalar FK columns that sit behind a relation from
// record.params, and declaring them under `properties` doesn't help. Re-read
// them from Prisma after AdminJS has built the response.
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

async function attachPackageServices(records) {
  const packageIds = records.map((r) => r.params?.id).filter(Boolean);
  if (!packageIds.length) return records;

  const rows = await prisma.package.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, services: { select: { id: true } } },
  });
  const byPackageId = new Map(rows.map((p) => [p.id, p.services.map((svc) => svc.id)]));

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
    const updated = await resource.findOne(record.id());
    return { record: updated.toJSON(currentAdmin) };
  }

  const current = all[index];
  const neighbor = all[neighborIndex];

  await prisma.$transaction([
    prisma.review.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.review.update({ where: { id: neighbor.id }, data: { order: current.order } }),
  ]);

  const updated = await resource.findOne(record.id());
  return { record: updated.toJSON(currentAdmin) };
}

async function reviewToggleVisibilityHandler(request, response, context) {
  const { record, currentAdmin, resource } = context;
  const approved = Boolean(request.payload?.approved);
  await prisma.review.update({ where: { id: record.id() }, data: { approved } });
  const updated = await resource.findOne(record.id());
  return { record: updated.toJSON(currentAdmin) };
}

// Enforced server-side so it holds even when an action is called directly.
function assertBookingEditable(existing) {
  if (existing?.status === "completed") {
    throw new Error("This booking is completed and can no longer be changed.");
  }
}

async function mountAdminPanel(app) {
  const { default: AdminJS, ComponentLoader } = await import("adminjs");
  const { default: AdminJSExpress } = await import("@adminjs/express");
  const { Database, Resource, getModelByName } = await import("@adminjs/prisma");

  AdminJS.registerAdapter({ Database, Resource });

  const componentLoader = new ComponentLoader();
  const component = (name, file) =>
    componentLoader.add(name, require.resolve(`./components/${file}.jsx`));

  const Components = {
    Dashboard: component("Dashboard", "Dashboard"),
    WorkingHoursEdit: component("WorkingHoursEdit", "WorkingHoursEdit"),
    PhotoUploadEdit: component("PhotoUploadEdit", "PhotoUploadEdit"),
    ServicesEdit: component("ServicesEdit", "ServiceEdit"),
    StaffCardList: component("StaffCardList", "StaffCardList"),
    StaffShow: component("StaffShow", "StaffShow"),
    StaffEdit: component("StaffEdit", "StaffEdit"),
    BookingCardList: component("BookingCardList", "BookingCardList"),
    BookingShow: component("BookingShow", "BookingShow"),
    ServiceCardList: component("ServiceCardList", "ServiceCardList"),
    ServiceShow: component("ServiceShow", "ServiceShow"),
    ServiceEdit: component("ServiceEdit", "ServiceEdit"),
    PackageCardList: component("PackageCardList", "PackageCardList"),
    PackageShow: component("PackageShow", "PackageShow"),
    PackageEdit: component("PackageEdit", "PackageEdit"),
    ReviewCardList: component("ReviewCardList", "ReviewCardList"),
    ReviewShow: component("ReviewShow", "ReviewShow"),
    TransformationCardList: component("TransformationCardList", "TransformationCardList"),
    TransformationShow: component("TransformationShow", "TransformationShow"),
    TransformationEdit: component("TransformationEdit", "TransformationEdit"),
  };

  const admin = new AdminJS({
    rootPath: "/backoffice",
    loginPath: "/backoffice/login",
    logoutPath: "/backoffice/logout",
    branding: { companyName: "Makeup Studio — Backoffice" },
    dashboard: { component: Components.Dashboard },
    locale: {
      language: "en",
      translations: { en: { labels: { navigation: "" } } },
    },
    componentLoader,
    resources: [
      {
        resource: { model: getModelByName("Staff"), client: prisma },
        options: {
          navigation: null,
          properties: {
            workingHours: { components: { edit: Components.WorkingHoursEdit } },
            photoUrl: { components: { edit: Components.PhotoUploadEdit } },
            services: {
              reference: "Service",
              isArray: true, // required for the many-to-many relation
              components: { edit: Components.ServicesEdit },
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
            // The filter sidebar (shown for enum properties) squeezes the custom list.
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
            list: {
              after: [bookingListAfter],
              component: Components.BookingCardList,
              showFilter: false,
            },
            show: {
              after: [bookingRecordAfter],
              component: Components.BookingShow,
            },

            // All changes go through the record actions below so each one is
            // checked, logged to BookingHistory and notified. isAccessible
            // (not just isVisible) so the generic actions can't be called directly.
            new: { isAccessible: false },
            edit: { isAccessible: false },

            delete: {
              // Hidden from the toolbar; the custom Delete button calls it.
              isVisible: false,
              guard:
                "This will hide the booking from normal views but keep its history. Continue?",
              handler: async (request, response, context) => {
                const { record, currentAdmin } = context;
                const existing = await prisma.booking.findUnique({
                  where: { id: record.id() },
                });
                assertBookingEditable(existing);
                await logAndNotify(record.id(), "soft_deleted", existing.status, "deleted", null);
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
              isVisible: false,
              after: [bookingRecordAfter],
              handler: async (request, response, context) => {
                const { record, currentAdmin, resource } = context;
                const startTime = request.payload?.startTime;
                if (!startTime) throw new Error("startTime is required");
                const existing = await prisma.booking.findUnique({
                  where: { id: record.id() },
                  include: { service: true, package: true },
                });
                assertBookingEditable(existing);
                const durationMinutes =
                  existing.package?.durationMinutes ?? existing.service?.durationMinutes;
                if (!durationMinutes) throw new Error("Unable to determine booking duration");
                const newStart = new Date(startTime);
                const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);
                await prisma.booking.update({
                  where: { id: record.id() },
                  data: { startTime: newStart, endTime: newEnd, status: "rescheduled" },
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
            services: { reference: "Service", isArray: true },
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
              before: [makePhotoUploadHook("imageUrl", "packages"), packageEditBefore],
              after: [packageEditAfter, packageRecordAfter],
              component: Components.PackageEdit,
            },
            edit: {
              before: [makePhotoUploadHook("imageUrl", "packages"), packageEditBefore],
              after: [packageEditAfter, packageRecordAfter],
              component: Components.PackageEdit,
            },
          },
        },
      },
      {
        resource: { model: getModelByName("Transformation"), client: prisma },
        options: {
          navigation: null,
          properties: {
            beforeUrl: { components: { edit: Components.PhotoUploadEdit } },
            afterUrl: { components: { edit: Components.PhotoUploadEdit } },
          },
          actions: {
            list: { component: Components.TransformationCardList, showFilter: false },
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
            // Review content comes from customers; admins only change order
            // and visibility through the actions below.
            new: { isAccessible: false },
            edit: { isAccessible: false },
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

  // Production images ship a prebuilt bundle (ADMIN_JS_SKIP_BUNDLE=true), so
  // initialize() is a no-op there; watch() rebuilds on change in dev.
  if (process.env.NODE_ENV === "production") {
    await admin.initialize();
  } else {
    await admin.watch();
  }

  const authenticate = async (email, password) => {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_ADMIN_HASH);
    return user && valid ? { email: user.email, id: user.id } : null;
  };

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: process.env.ADMIN_SESSION_SECRET,
    },
    null,
    {
      // Sessions live in Redis so a login is valid on every replica.
      store: new RedisStore({ client: redis, prefix: "salon:sess:" }),
      name: "salon.sid",
      proxy: true,
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_SESSION_SECRET,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure,
      },
    },
  );

  app.use(admin.options.rootPath, adminRouter);
}

module.exports = { mountAdminPanel };