const UserCoupon = require('../models/UserCoupon');
const Coupon = require('../models/Coupon');
const User = require('../models/User');

class UserCouponController {
    // Lấy danh sách mã giảm giá của user
    async getUserCoupons(req, res) {
        try {
            const userID = req.user.userID;
            const { status } = req.query;

            // Tạo filter dựa trên status nếu có
            const filter = { userID };
            if (status) {
                filter.status = status;
            }

            const userCoupons = await UserCoupon.find(filter)
                .populate('couponID')
                .sort('-createdAt');

            res.json(userCoupons);
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách mã giảm giá',
                error: error.message
            });
        }
    }

    // Lấy chi tiết mã giảm giá của user
    async getUserCouponById(req, res) {
        try {
            const { id } = req.params;
            const userID = req.user.userID;

            const userCoupon = await UserCoupon.findOne({
                userCouponsID: id,
                userID
            }).populate('couponID');

            if (!userCoupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
            }

            res.json(userCoupon);
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy thông tin mã giảm giá',
                error: error.message
            });
        }
    }

    // ADMIN: Thêm mã giảm giá cho user
    async addUserCoupon(req, res) {
        try {
            const { userID, couponID, usageLeft, expiryDate } = req.body;

            // Kiểm tra user và coupon tồn tại
            const [user, coupon] = await Promise.all([
                User.findOne({ userID }),
                Coupon.findOne({ couponID })
            ]);

            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' });
            }
            if (!coupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
            }

            // Kiểm tra user đã có mã giảm giá này chưa
            const existingCoupon = await UserCoupon.findOne({ userID, couponID });
            if (existingCoupon) {
                return res.status(400).json({ message: 'Người dùng đã có mã giảm giá này' });
            }

            // Tạo ID mới cho user coupon
            const lastUserCoupon = await UserCoupon.findOne().sort({ userCouponsID: -1 });
            const userCouponsID = lastUserCoupon ? lastUserCoupon.userCouponsID + 1 : 1;

            const userCoupon = new UserCoupon({
                userCouponsID,
                userID,
                couponID,
                usageLeft: usageLeft || coupon.maxUsagePerUser,
                expiryDate: expiryDate || coupon.expiryDate
            });

            await userCoupon.save();

            res.status(201).json({
                message: 'Thêm mã giảm giá cho người dùng thành công',
                userCoupon
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi thêm mã giảm giá',
                error: error.message
            });
        }
    }

    // ADMIN: Cập nhật mã giảm giá của user
    async updateUserCoupon(req, res) {
        try {
            const { id } = req.params;
            const { usageLeft, expiryDate, status } = req.body;

            const userCoupon = await UserCoupon.findOne({ userCouponsID: id });
            if (!userCoupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
            }

            // Cập nhật thông tin
            if (typeof usageLeft === 'number') userCoupon.usageLeft = usageLeft;
            if (expiryDate) userCoupon.expiryDate = expiryDate;
            if (status) userCoupon.status = status;

            await userCoupon.save();

            res.json({
                message: 'Cập nhật mã giảm giá thành công',
                userCoupon
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật mã giảm giá',
                error: error.message
            });
        }
    }

    // ADMIN: Hủy mã giảm giá của user
    async cancelUserCoupon(req, res) {
        try {
            const { id } = req.params;

            const userCoupon = await UserCoupon.findOne({ userCouponsID: id });
            if (!userCoupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
            }

            // Kiểm tra mã giảm giá đã được sử dụng chưa
            if (userCoupon.usageHistory.length > 0) {
                return res.status(400).json({
                    message: 'Không thể hủy mã giảm giá đã được sử dụng'
                });
            }

            userCoupon.status = 'cancelled';
            await userCoupon.save();

            res.json({
                message: 'Hủy mã giảm giá thành công',
                userCoupon
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi hủy mã giảm giá',
                error: error.message
            });
        }
    }

    // Sử dụng mã giảm giá
    async useUserCoupon(req, res) {
        try {
            const { id } = req.params;
            const { orderID, discountAmount } = req.body;
            const userID = req.user.userID;

            const userCoupon = await UserCoupon.findOne({
                userCouponsID: id,
                userID,
                status: 'active'
            });

            if (!userCoupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá hợp lệ' });
            }

            // Kiểm tra đơn hàng tồn tại
            const Order = require('../models/Order');
            const order = await Order.findOne({ orderID });
            if (!order) {
                return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
            }

            // Kiểm tra đơn hàng thuộc về user
            if (order.userID !== userID) {
                return res.status(403).json({ message: 'Bạn không có quyền sử dụng mã giảm giá cho đơn hàng này' });
            }

            // Sử dụng mã giảm giá
            await userCoupon.use(orderID, discountAmount);

            res.json({
                message: 'Sử dụng mã giảm giá thành công',
                userCoupon
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi sử dụng mã giảm giá',
                error: error.message
            });
        }
    }

    // ADMIN: Lấy danh sách mã giảm giá của tất cả user
    async getAllUserCoupons(req, res) {
        try {
            const { page = 1, limit = 10, status, userID } = req.query;

            // Tạo filter dựa trên status và userID nếu có
            const filter = {};
            if (status) filter.status = status;
            if (userID) filter.userID = userID;

            const userCoupons = await UserCoupon.find(filter)
                .populate('couponID')
                .populate('userID', 'fullname email phone')
                .sort('-createdAt')
                .skip((page - 1) * limit)
                .limit(limit);

            // Đếm tổng số mã giảm giá
            const total = await UserCoupon.countDocuments(filter);

            res.json({
                userCoupons,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách mã giảm giá',
                error: error.message
            });
        }
    }
}

module.exports = new UserCouponController();
