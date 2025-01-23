const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/ProductController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

// Routes cho người dùng
router.get('/', ProductController.getProducts); // Lấy danh sách sản phẩm (có phân trang và lọc)
router.get('/basic', ProductController.getAllProductsBasicInfo); // Lấy thông tin cơ bản của tất cả sản phẩm (không phân trang)
router.get('/gender', ProductController.getProductsByGender); // Lấy sản phẩm theo giới tính
router.get('/:id', ProductController.getProductById); // Lấy chi tiết sản phẩm

// Routes cho admin (yêu cầu đăng nhập và quyền admin)
router.post('/', authenticateToken, isAdmin, ProductController.createProduct); // Tạo sản phẩm mới
router.put('/:id', authenticateToken, isAdmin, ProductController.updateProduct); // Cập nhật sản phẩm
router.delete('/:id', authenticateToken, isAdmin, ProductController.deleteProduct); // Xóa sản phẩm (soft delete)
router.patch('/:id/restore', authenticateToken, isAdmin, ProductController.restoreProduct); // Khôi phục sản phẩm
router.get('/admin/products', authenticateToken, isAdmin, ProductController.getProductsChoADMIN); // Lấy danh sách sản phẩm cho admin

module.exports = router;
