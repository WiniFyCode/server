const Coupon = require('../models/Coupon');
const UserCoupon = require('../models/UserCoupon');

class CouponController {
    // ADMIN: Lấy tất cả mã giảm giá
    async getAllCoupons(req, res) {
        try {
            const { page = 1, limit = 10, search } = req.query;

            // Tạo filter dựa trên search nếu có
            const filter = {};
            if (search) {
                filter.$or = [
                    { code: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Lấy danh sách mã giảm giá với phân trang
            const coupons = await Coupon.find(filter)
                .sort('-createdAt')
                .skip((page - 1) * limit)
                .limit(limit);

            // Đếm tổng số mã giảm giá
            const total = await Coupon.countDocuments(filter);

            res.json({
                coupons,
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

    // ADMIN: Tạo mã giảm giá mới
    async createCoupon(req, res) {
        try {
            const {
                code,
                description,
                discountType,
                discountValue,
                minOrderValue,
                maxDiscountAmount,
                startDate,
                endDate,
                maxUsageCount,
                maxUsagePerUser,
                isActive = true
            } = req.body;

            // Kiểm tra mã đã tồn tại chưa
            const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
            if (existingCoupon) {
                return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
            }

            // Tạo ID mới cho coupon
            const lastCoupon = await Coupon.findOne().sort({ couponID: -1 });
            const couponID = lastCoupon ? lastCoupon.couponID + 1 : 1;

            const coupon = new Coupon({
                couponID,
                code,
                description,
                discountType,
                discountValue,
                minOrderValue,
                maxDiscountAmount,
                startDate,
                endDate,
                maxUsageCount,
                maxUsagePerUser,
                isActive
            });

            await coupon.save();

            res.status(201).json({
                message: 'Tạo mã giảm giá thành công',
                coupon
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi tạo mã giảm giá',
                error: error.message
            });
        }
    }

    // ADMIN: Cập nhật mã giảm giá
    async updateCoupon(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Kiểm tra mã giảm giá tồn tại
            const coupon = await Coupon.findOne({ couponID: id });
            if (!coupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
            }

            // Nếu cập nhật code, kiểm tra code mới đã tồn tại chưa
            if (updateData.code && updateData.code !== coupon.code) {
                const existingCoupon = await Coupon.findOne({ 
                    code: updateData.code.toUpperCase(),
                    couponID: { $ne: id }
                });
                if (existingCoupon) {
                    return res.status(400).json({ message: 'Mã giảm giá đã tồn tại' });
                }
            }

            // Cập nhật thông tin
            Object.assign(coupon, updateData);
            await coupon.save();

            res.json({
                message: 'Cập nhật mã giảm giá thành công',
                coupon
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật mã giảm giá',
                error: error.message
            });
        }
    }

    // ADMIN: Xóa mã giảm giá
    async deleteCoupon(req, res) {
        try {
            const { id } = req.params;

            // Kiểm tra mã giảm giá tồn tại
            const coupon = await Coupon.findOne({ couponID: id });
            if (!coupon) {
                return res.status(404).json({ message: 'Không tìm thấy mã giảm giá' });
            }

            // Kiểm tra có user nào đang sử dụng mã không
            const usersUsingCoupon = await UserCoupon.countDocuments({ couponID: id });
            if (usersUsingCoupon > 0) {
                return res.status(400).json({
                    message: 'Không thể xóa mã giảm giá này vì đang có người dùng sử dụng'
                });
            }

            await coupon.deleteOne();

            res.json({ message: 'Xóa mã giảm giá thành công' });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa mã giảm giá',
                error: error.message
            });
        }
    }

    // USER: Lấy danh sách mã giảm giá có thể sử dụng
    async getAvailableCoupons(req, res) {
        try {
            const userID = req.user.userID;
            const { orderValue } = req.query;

            // Lấy tất cả mã giảm giá đang hoạt động
            const coupons = await Coupon.find({
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gt: new Date() },
                minOrderValue: { $lte: orderValue || 0 }
            });

            // Kiểm tra điều kiện sử dụng cho từng mã
            const availableCoupons = await Promise.all(coupons.map(async (coupon) => {
                // Kiểm tra số lần sử dụng tổng
                const totalUsage = await UserCoupon.countDocuments({ couponID: coupon.couponID });
                if (totalUsage >= coupon.maxUsageCount) {
                    return null;
                }

                // Kiểm tra số lần sử dụng của user
                const userUsage = await UserCoupon.countDocuments({
                    couponID: coupon.couponID,
                    userID
                });
                if (userUsage >= coupon.maxUsagePerUser) {
                    return null;
                }

                return {
                    ...coupon.toJSON(),
                    usageLeft: coupon.maxUsagePerUser - userUsage
                };
            }));

            // Lọc bỏ các mã không thể sử dụng
            const validCoupons = availableCoupons.filter(coupon => coupon !== null);

            res.json(validCoupons);
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách mã giảm giá',
                error: error.message
            });
        }
    }

    // USER: Áp dụng mã giảm giá
    async applyCoupon(req, res) {
        try {
            const userID = req.user.userID;
            const { code, orderValue } = req.body;

            // Tìm mã giảm giá
            const coupon = await Coupon.findOne({
                code: code.toUpperCase(),
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gt: new Date() }
            });

            if (!coupon) {
                return res.status(404).json({ message: 'Mã giảm giá không tồn tại hoặc đã hết hạn' });
            }

            // Kiểm tra giá trị đơn hàng tối thiểu
            if (orderValue < coupon.minOrderValue) {
                return res.status(400).json({
                    message: `Đơn hàng phải từ ${coupon.minOrderValue}đ trở lên để sử dụng mã giảm giá này`
                });
            }

            // Kiểm tra số lần sử dụng tổng
            const totalUsage = await UserCoupon.countDocuments({ couponID: coupon.couponID });
            if (totalUsage >= coupon.maxUsageCount) {
                return res.status(400).json({ message: 'Mã giảm giá đã hết lượt sử dụng' });
            }

            // Kiểm tra và cập nhật UserCoupon
            let userCoupon = await UserCoupon.findOne({
                couponID: coupon.couponID,
                userID
            });

            if (userCoupon) {
                // Nếu đã có bản ghi, kiểm tra số lượt còn lại
                if (userCoupon.usageLeft <= 0) {
                    return res.status(400).json({ message: 'Bạn đã sử dụng hết lượt của mã giảm giá này' });
                }
                // Cập nhật số lượt còn lại
                userCoupon.usageLeft -= 1;
                await userCoupon.save();
            } else {
                // Tạo UserCoupon mới nếu chưa có
                const lastUserCoupon = await UserCoupon.findOne().sort({ userCouponsID: -1 });
                const userCouponsID = lastUserCoupon ? lastUserCoupon.userCouponsID + 1 : 1;

                userCoupon = new UserCoupon({
                    userCouponsID,
                    couponID: coupon.couponID,
                    userID,
                    usageLeft: coupon.maxUsagePerUser - 1, // Trừ đi 1 vì đang sử dụng
                    expiryDate: coupon.endDate
                });
                await userCoupon.save();
            }

            // Tính số tiền giảm
            let discountAmount;
            if (coupon.discountType === 'percentage') {
                discountAmount = Math.min(
                    orderValue * (coupon.discountValue / 100),
                    coupon.maxDiscountAmount
                );
            } else {
                discountAmount = Math.min(
                    coupon.discountValue,
                    coupon.maxDiscountAmount
                );
            }

            res.json({
                message: 'Áp dụng mã giảm giá thành công',
                coupon,
                discountAmount,
                userCouponsID: userCoupon.userCouponsID
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi áp dụng mã giảm giá',
                error: error.message
            });
        }
    }

    // USER: Lấy lịch sử sử dụng mã giảm giá
    async getCouponHistory(req, res) {
        try {
            const userID = req.user.userID;
            const { page = 1, limit = 10 } = req.query;

            // Lấy lịch sử sử dụng mã giảm giá với phân trang
            const userCoupons = await UserCoupon.find({ userID })
                .sort('-createdAt')
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                    path: 'couponInfo',
                    select: 'code description discountType discountValue'
                })
                .populate({
                    path: 'usageHistory.orderInfo',
                    select: 'orderID totalAmount status'
                });

            // Đếm tổng số mã đã sử dụng
            const total = await UserCoupon.countDocuments({ userID });

            res.json({
                userCoupons,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy lịch sử sử dụng mã giảm giá',
                error: error.message
            });
        }
    }
}

module.exports = new CouponController();
