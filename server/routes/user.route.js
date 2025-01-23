const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');

// Routes cho người dùng
router.get('/profile', authenticateToken, UserController.getProfile); // Lấy thông tin cá nhân
router.put('/profile', authenticateToken, UserController.updateProfile); // Cập nhật thông tin cá nhân
router.put('/change-password', authenticateToken, UserController.changePassword); // Đổi mật khẩu

// Routes cho admin
router.get('/', authenticateToken, isAdmin, UserController.getUsers); // Lấy danh sách người dùng
router.get('/:id', authenticateToken, isAdmin, UserController.getUserById); // Lấy chi tiết người dùng
router.post('/', authenticateToken, isAdmin, UserController.createUser); // Tạo tài khoản mới
router.put('/:id', authenticateToken, isAdmin, UserController.updateUser); // Cập nhật thông tin người dùng
router.patch('/:id/status', authenticateToken, isAdmin, UserController.toggleUserStatus); // Vô hiệu hóa/Kích hoạt tài khoản

module.exports = router;
