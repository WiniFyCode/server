const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const app = express();
const fs = require('fs');

// Cấu hình môi trườngg
dotenv.config();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Phục vụ static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Kết nối đến MongoDB
mongoose
  .connect(process.env.MONGODB_URI,)
  .then(() => console.log("✅Kết nối đến MongoDB thành công"))
  .catch((err) => console.error("❌Kết nối đến MongoDB thất bại:", err));

// Import routes
const authRoutes = require('./routes/auth.route');
const addressRoutes = require('./routes/address.route');
const cartRoutes = require('./routes/cart.route');
const categoryRoutes = require('./routes/category.route');
const couponRoutes = require('./routes/coupon.route');
const favoriteRoutes = require('./routes/favorite.route');
const notificationRoutes = require('./routes/notification.route');
const orderDetailRoutes = require('./routes/order-detail.route');
const orderRoutes = require('./routes/order.route');
const productRoutes = require('./routes/product.route');
const targetRoutes = require('./routes/target.route');
const userCouponRoutes = require('./routes/user-coupon.route');
const userNotificationRoutes = require('./routes/user-notification.route');
const reviewRoutes = require('./routes/review.route');
const userRoutes = require('./routes/user.route');
// const paymentRoutes = require('./routes/payment.route');
// const statisticRoutes = require('./routes/statistic.route');

// Import authentication middleware
const { authenticateAdmin, authenticateCustomer } = require("./middlewares/auth.middleware");

// Public routes (không cần xác thực)
app.use('/api/auth', authRoutes);// Đăng ký và đăng nhập
app.use('/api/products', productRoutes);// Xem sản phẩm
app.use('/api/categories', categoryRoutes);// Xem danh mục

// Customer routes (cần xác thực customer)
app.use('/api/address', authenticateCustomer, addressRoutes);// Quản lý địa chỉ
app.use('/api/cart', authenticateCustomer, cartRoutes);// Quản lý giỏ hàng
app.use('/api/favorite', authenticateCustomer, favoriteRoutes);// Quản lý yêu thích
app.use('/api/coupon', authenticateCustomer, couponRoutes);// Quản lý mã giảm giá
app.use('/api/notification', authenticateCustomer, notificationRoutes);// Quản lý thông báo
app.use('/api/order-detail', authenticateCustomer, orderDetailRoutes);// Quản lý chi tiết đơn hàng
app.use('/api/user', authenticateCustomer, userRoutes);// Quản lý thông tin cá nhân
app.use('/api/review', authenticateCustomer, reviewRoutes);// Đánh giá sản phẩm
app.use('/api/order', authenticateCustomer, orderRoutes);// Quản lý đơn hàng
app.use('/api/target', targetRoutes);// Quản lý target
app.use('/api/user-coupon', authenticateCustomer, userCouponRoutes);// Quản lý mã giảm giá
app.use('/api/user-notification', authenticateCustomer, userNotificationRoutes);// Quản lý thông báo
// app.use('/api/payment', authenticateCustomer, paymentRoutes);// Thanh toán

// Admin routes (cần xác thực admin)
app.use('/api/admin', authenticateAdmin, (req, res, next) => {
  console.log("Đã xác thực admin");
  next();
});

app.use('/api/admin/products', authenticateAdmin, productRoutes);// Quản lý sản phẩm
app.use('/api/admin/categories', authenticateAdmin, categoryRoutes);// Quản lý danh mục
app.use('/api/admin/users', authenticateAdmin, userRoutes);// Quản lý người dùng
app.use('/api/admin/orders', authenticateAdmin, orderRoutes);// Quản lý đơn hàng
app.use('/api/admin/coupons', authenticateAdmin, couponRoutes);// Quản lý mã giảm giá
// app.use('/api/admin/statistics', authenticateAdmin, statisticRoutes);// Thống kê

// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
