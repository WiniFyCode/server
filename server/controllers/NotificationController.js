const Notification = require('../models/Notification');
const UserNotification = require('../models/UserNotification');
const User = require('../models/User');

class NotificationController {
    // ADMIN: Tạo thông báo mới
    async createNotification(req, res) {
        try {
            const adminID = req.user.userID;
            const { title, type, message, scheduledFor, expiresAt, userIDs = [] } = req.body;

            // Tạo ID mới cho notification
            const lastNotification = await Notification.findOne().sort({ notificationID: -1 });
            const notificationID = lastNotification ? lastNotification.notificationID + 1 : 1;

            // Tạo thông báo mới
            const notification = new Notification({
                notificationID,
                title,
                type,
                message,
                scheduledFor: new Date(scheduledFor),
                expiresAt: new Date(expiresAt),
                createdBy: adminID
            });

            await notification.save();

            // Nếu có danh sách user cụ thể
            if (userIDs.length > 0) {
                // Kiểm tra các user tồn tại
                const users = await User.find({ userID: { $in: userIDs } });
                if (users.length !== userIDs.length) {
                    return res.status(400).json({ message: 'Một số user không tồn tại' });
                }

                // Tạo user notification cho từng user
                const lastUserNotification = await UserNotification.findOne().sort({ userNotificationID: -1 });
                let userNotificationID = lastUserNotification ? lastUserNotification.userNotificationID + 1 : 1;

                const userNotifications = users.map(user => ({
                    userNotificationID: userNotificationID++,
                    notificationID,
                    userID: user.userID
                }));

                await UserNotification.insertMany(userNotifications);
            } else {
                // Gửi cho tất cả user
                const users = await User.find();
                const lastUserNotification = await UserNotification.findOne().sort({ userNotificationID: -1 });
                let userNotificationID = lastUserNotification ? lastUserNotification.userNotificationID + 1 : 1;

                const userNotifications = users.map(user => ({
                    userNotificationID: userNotificationID++,
                    notificationID,
                    userID: user.userID
                }));

                await UserNotification.insertMany(userNotifications);
            }

            res.status(201).json({
                message: 'Tạo thông báo thành công',
                notification
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi tạo thông báo',
                error: error.message
            });
        }
    }

    // ADMIN: Cập nhật thông báo
    async updateNotification(req, res) {
        try {
            const { id } = req.params;
            const { title, message, scheduledFor, expiresAt } = req.body;

            const notification = await Notification.findOne({ notificationID: id });
            if (!notification) {
                return res.status(404).json({ message: 'Không tìm thấy thông báo' });
            }

            // Chỉ cho phép cập nhật thông báo chưa gửi
            if (!notification.isPending) {
                return res.status(400).json({ message: 'Không thể cập nhật thông báo đã gửi' });
            }

            // Cập nhật thông tin
            if (title) notification.title = title;
            if (message) notification.message = message;
            if (scheduledFor) notification.scheduledFor = new Date(scheduledFor);
            if (expiresAt) notification.expiresAt = new Date(expiresAt);

            await notification.save();

            res.json({
                message: 'Cập nhật thông báo thành công',
                notification
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật thông báo',
                error: error.message
            });
        }
    }

    // ADMIN: Xóa thông báo
    async deleteNotification(req, res) {
        try {
            const { id } = req.params;

            const notification = await Notification.findOne({ notificationID: id });
            if (!notification) {
                return res.status(404).json({ message: 'Không tìm thấy thông báo' });
            }

            // Chỉ cho phép xóa thông báo chưa gửi
            if (!notification.isPending) {
                return res.status(400).json({ message: 'Không thể xóa thông báo đã gửi' });
            }

            // Xóa thông báo và các user notification liên quan
            await Promise.all([
                notification.deleteOne(),
                UserNotification.deleteMany({ notificationID: id })
            ]);

            res.json({ message: 'Xóa thông báo thành công' });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa thông báo',
                error: error.message
            });
        }
    }

    // ADMIN: Lấy danh sách tất cả thông báo
    async getAllNotifications(req, res) {
        try {
            const { page = 1, limit = 10, type } = req.query;

            // Query base
            const query = {};
            if (type) query.type = type;

            // Lấy danh sách thông báo với phân trang
            const [notifications, total] = await Promise.all([
                Notification.find(query)
                    .sort('-createdAt')
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .populate('createdBy', 'username'),
                Notification.countDocuments(query)
            ]);

            res.json({
                notifications,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách thông báo',
                error: error.message
            });
        }
    }

    // USER: Lấy danh sách thông báo của user
    async getUserNotifications(req, res) {
        try {
            const userID = req.user.userID;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            // Lấy danh sách thông báo của user
            const userNotifications = await UserNotification.find({ userID })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            // Lấy thông tin chi tiết của từng thông báo
            const notifications = await Promise.all(
                userNotifications.map(async (un) => {
                    const notification = await Notification.findOne({ notificationID: un.notificationID }).lean();
                    return {
                        ...notification,
                        isRead: un.isRead,
                        readAt: un.readAt,
                        userNotificationID: un.userNotificationID
                    };
                })
            );

            // Đếm tổng số thông báo
            const total = await UserNotification.countDocuments({ userID });

            res.json({
                message: 'Lấy danh sách thông báo thành công',
                notifications,
                pagination: {
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error('Error in getUserNotifications:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy danh sách thông báo',
                error: error.message
            });
        }
    }

    // USER: Đánh dấu thông báo đã đọc
    async markAsRead(req, res) {
        try {
            const userID = req.user.userID;
            const { id } = req.params; // id là userNotificationID

            const userNotification = await UserNotification.findOne({ 
                userNotificationID: parseInt(id),
                userID 
            });

            if (!userNotification) {
                return res.status(404).json({
                    message: 'Không tìm thấy thông báo'
                });
            }

            // Đánh dấu đã đọc
            await userNotification.markAsRead();

            res.json({
                message: 'Đánh dấu thông báo đã đọc thành công'
            });
        } catch (error) {
            console.error('Error in markAsRead:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi đánh dấu thông báo đã đọc',
                error: error.message
            });
        }
    }

    // USER: Đánh dấu tất cả thông báo đã đọc
    async markAllAsRead(req, res) {
        try {
            const userID = req.user.userID;

            const result = await UserNotification.updateMany(
                { userID, isRead: false },
                { isRead: true, readAt: new Date() }
            );

            res.json({
                message: 'Đánh dấu tất cả đã đọc thành công',
                modifiedCount: result.modifiedCount
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi đánh dấu tất cả đã đọc',
                error: error.message
            });
        }
    }

    // USER: Lấy số lượng thông báo chưa đọc
    async getUnreadCount(req, res) {
        try {
            const userID = req.user.userID;
            const count = await UserNotification.getUnreadCount(userID);

            res.json({
                message: 'Lấy số lượng thông báo chưa đọc thành công',
                count
            });
        } catch (error) {
            console.error('Error in getUnreadCount:', error);
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy số lượng thông báo chưa đọc',
                error: error.message
            });
        }
    }
}

module.exports = new NotificationController();
