const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

// Routes cho người dùng (yêu cầu đăng nhập)
router.get('/my-orders', authenticateToken, OrderController.getOrders); // Lấy danh sách đơn hàng của user
router.get('/my-orders/:id', authenticateToken, OrderController.getOrderById); // Lấy chi tiết đơn hàng
router.post('/create', authenticateToken, OrderController.createOrder); // Tạo đơn hàng mới
router.post('/cancel/:id', authenticateToken, OrderController.cancelOrder); // Hủy đơn hàng

// Routes cho admin
router.get('/', authenticateToken, isAdmin, OrderController.getAllOrders); // Lấy tất cả đơn hàng
router.put('/:id/status', authenticateToken, isAdmin, OrderController.updateOrderStatus); // Cập nhật trạng thái đơn hàng

module.exports = router;
