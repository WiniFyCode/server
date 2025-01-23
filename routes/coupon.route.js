const express = require('express');
const router = express.Router();
const CouponController = require('../controllers/CouponController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

// Routes cho admin
router.get('/all', authenticateToken, isAdmin, CouponController.getAllCoupons); // Lấy tất cả mã giảm giá
router.post('/', authenticateToken, isAdmin, CouponController.createCoupon); // Tạo mã giảm giá mới
router.put('/:id', authenticateToken, isAdmin, CouponController.updateCoupon); // Cập nhật mã giảm giá
router.delete('/:id', authenticateToken, isAdmin, CouponController.deleteCoupon); // Xóa mã giảm giá

// Routes cho người dùng
router.get('/available', authenticateToken, CouponController.getAvailableCoupons); // Lấy danh sách mã có thể sử dụng
router.post('/apply', authenticateToken, CouponController.applyCoupon); // Áp dụng mã giảm giá
router.get('/history', authenticateToken, CouponController.getCouponHistory); // Lấy lịch sử sử dụng mã

module.exports = router;
