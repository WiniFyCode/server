const express = require('express');
const router = express.Router();
const ProductSizeStockController = require('../controllers/ProductSizeStockController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

// Routes cho người dùng
router.get('/sku/:SKU', ProductSizeStockController.getStockBySKU); // Lấy thông tin tồn kho theo SKU
router.get('/color/:colorID', ProductSizeStockController.getStockByColor); // Lấy tồn kho theo màu

// Routes cho admin
router.post('/', authenticateToken, isAdmin, ProductSizeStockController.addStock); // Thêm size và số lượng
router.put('/:SKU', authenticateToken, isAdmin, ProductSizeStockController.updateStock); // Cập nhật số lượng
router.delete('/:SKU', authenticateToken, isAdmin, ProductSizeStockController.deleteStock); // Xóa size
router.post('/check-batch', authenticateToken, isAdmin, ProductSizeStockController.checkStockBatch); // Kiểm tra tồn kho hàng loạt

module.exports = router;
