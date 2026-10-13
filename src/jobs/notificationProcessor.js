// The actual work done for each queued notification job. Kept separate
// from worker.js so it can be unit-tested without spinning up a Worker.
const prisma = require("../lib/prisma");
const { sendSms } = require("../lib/twilio");
const { sendEmail } = require("../lib/brevo");

const TEMPLATES = {
  "booking.created": (b) => ({
    sms: `Booking confirmed! Your application ID is ${b.applicationId}. See you on ${b.startTime.toLocaleString()}.`,
    subject: "Your booking is confirmed",
    html: `<p>Your application ID is <strong>${b.applicationId}</strong>.</p><p>Appointment: ${b.startTime.toLocaleString()} for ${b.service.name}.</p>`,
  }),
  "booking.modified": (b) => ({
    sms: `Your booking ${b.applicationId} was updated. New time: ${b.startTime.toLocaleString()}.`,
    subject: "Your booking was updated",
    html: `<p>Booking <strong>${b.applicationId}</strong> was updated. New time: ${b.startTime.toLocaleString()}.</p>`,
  }),
  "booking.cancelled": (b) => ({
    sms: `Your booking ${b.applicationId} has been cancelled.`,
    subject: "Your booking was cancelled",
    html: `<p>Booking <strong>${b.applicationId}</strong> has been cancelled.</p>`,
  }),
  "booking.staff_assigned": (b) => ({
    sms: `${b.staff?.name || "A staff member"} has been assigned to your booking ${b.applicationId}.`,
    subject: "Staff assigned to your booking",
    html: `<p>${b.staff?.name || "A staff member"} has been assigned to booking <strong>${b.applicationId}</strong>.</p>`,
  }),
  "booking.rescheduled": (b) => ({
    sms: `Your booking ${b.applicationId} was rescheduled to ${b.startTime.toLocaleString()}.`,
    subject: "Your booking was rescheduled",
    html: `<p>Booking <strong>${b.applicationId}</strong> was rescheduled to ${b.startTime.toLocaleString()}.</p>`,
  }),
  "booking.reminder": (b) => ({
    sms: `Reminder: your appointment (${b.applicationId}) is tomorrow at ${b.startTime.toLocaleTimeString()}.`,
    subject: "Appointment reminder",
    html: `<p>Reminder: your appointment <strong>${b.applicationId}</strong> is tomorrow at ${b.startTime.toLocaleTimeString()}.</p>`,
  }),
  "booking.completed": (b) => ({
    sms: `Your appointment (${b.applicationId}) is completed.`,
    subject: "Appointment completed",
    html: `<p>Your appointment (${b.applicationId}) is completed.</p>`,
  }),
};

async function processNotificationJob(job) {
  const { name, data } = job;
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { service: true, staff: true },
  });

  if (!booking) return; // booking may have been deleted; nothing to notify

  const template = TEMPLATES[name];
  if (!template) return;

  const { sms, subject, html } = template(booking);

  await Promise.allSettled([
    // sendSms(booking.customerPhone, sms),
    sendEmail(booking.customerEmail, subject, html),
  ]);
}

module.exports = { processNotificationJob };
