// Admin moderation of customer reviews before they go public.
const prisma = require('../../lib/prisma');

async function list(req, res, next) {
  try {
    const reviews = await prisma.review.findMany({
      include: { booking: { select: { customerName: true, applicationId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

async function setApproved(req, res, next) {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const review = await prisma.review.update({ where: { id }, data: { approved: Boolean(approved) } });
    res.json(review);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, setApproved };
