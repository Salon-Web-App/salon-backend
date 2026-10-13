const express = require('express');
const multer = require('multer');
const router = express.Router();
const staffController = require('../../controllers/admin/staff.controller');
const { requireAdmin } = require('../../middlewares/auth.middleware');
const { adminWriteLimiter } = require('../../middlewares/rateLimit.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAdmin);
router.use(adminWriteLimiter);

router.get('/', staffController.list);
router.post('/', upload.single('photo'), staffController.create);
router.patch('/:id', upload.single('photo'), staffController.update);
router.delete('/:id', staffController.remove);

module.exports = router;
