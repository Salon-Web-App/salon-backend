const express = require('express');
const multer = require('multer');
const router = express.Router();
const servicesController = require('../../controllers/admin/services.controller');
const { requireAdmin } = require('../../middlewares/auth.middleware');
const { adminWriteLimiter } = require('../../middlewares/rateLimit.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAdmin);
router.use(adminWriteLimiter);

router.get('/', servicesController.list);
router.post('/', upload.single('image'), servicesController.create);
router.patch('/:id', upload.single('image'), servicesController.update);
router.delete('/:id', servicesController.remove);

module.exports = router;
