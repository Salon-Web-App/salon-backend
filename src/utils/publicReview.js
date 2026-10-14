// Reviews are public, so customer names are shortened to "First L.".
function shortName(fullName) {
  if (typeof fullName !== "string" || !fullName.trim()) return "Verified Client";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

const PUBLIC_REVIEW_INCLUDE = {
  booking: {
    select: {
      customerName: true,
      service: { select: { name: true } },
      package: { select: { title: true } },
    },
  },
};

function toPublicReview(review) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    customerName: shortName(review.booking?.customerName),
    serviceName: review.booking?.service?.name ?? review.booking?.package?.title ?? null,
  };
}

module.exports = { shortName, toPublicReview, PUBLIC_REVIEW_INCLUDE };
