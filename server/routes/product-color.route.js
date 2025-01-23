const express = require('express');
const router = express.Router();
const ProductColorController = require('../controllers/ProductColorController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

// Routes cho người dùng
router.get('/product/:productID', ProductColorController.getProductColors); // Lấy tất cả màu của sản phẩm
router.get('/:id', ProductColorController.getColorById); // Lấy chi tiết màu

// Routes cho admin
router.post('/', authenticateToken, isAdmin, ProductColorController.addColor); // Thêm màu mới
router.put('/:id', authenticateToken, isAdmin, ProductColorController.updateColor); // Cập nhật màu
router.delete('/:id', authenticateToken, isAdmin, ProductColorController.deleteColor); // Xóa màu
router.post('/:id/images', authenticateToken, isAdmin, ProductColorController.uploadImages); // Upload hình ảnh
router.delete('/:id/images', authenticateToken, isAdmin, ProductColorController.deleteImage); // Xóa hình ảnh

module.exports = router;
