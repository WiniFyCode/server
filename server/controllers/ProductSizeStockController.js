const ProductSizeStock = require('../models/ProductSizeStock');
const ProductColor = require('../models/ProductColor');

class ProductSizeStockController {
    // Lấy thông tin tồn kho theo SKU
    async getStockBySKU(req, res) {
        try {
            const { SKU } = req.params;

            const stockItem = await ProductSizeStock.findOne({ SKU })
                .populate({
                    path: 'colorID',
                    populate: {
                        path: 'productID',
                        model: 'Product',
                        populate: ['targetInfo', 'categoryInfo']
                    }
                });

            if (!stockItem) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin tồn kho' });
            }

            res.json(stockItem);
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy thông tin tồn kho',
                error: error.message
            });
        }
    }

    // Lấy tất cả size và số lượng tồn của một màu sản phẩm
    async getStockByColor(req, res) {
        try {
            const { colorID } = req.params;

            const stockItems = await ProductSizeStock.find({ colorID })
                .populate({
                    path: 'colorID',
                    populate: {
                        path: 'productID',
                        model: 'Product'
                    }
                })
                .sort('size');

            res.json(stockItems);
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi lấy thông tin tồn kho',
                error: error.message
            });
        }
    }

    // ADMIN: Thêm size và số lượng tồn kho cho màu sản phẩm
    async addStock(req, res) {
        try {
            const { colorID, size, stock } = req.body;

            // Kiểm tra màu sản phẩm tồn tại
            const color = await ProductColor.findOne({ colorID });
            if (!color) {
                return res.status(404).json({ message: 'Không tìm thấy màu sản phẩm' });
            }

            // Kiểm tra size đã tồn tại chưa
            const existingStock = await ProductSizeStock.findOne({ colorID, size });
            if (existingStock) {
                return res.status(400).json({ message: 'Size này đã tồn tại cho màu sản phẩm' });
            }

            // Tạo SKU mới: productID_colorID_size_version
            const version = 1; // Version đầu tiên
            const SKU = `${color.productID}_${colorID}_${size}_${version}`;

            const stockItem = new ProductSizeStock({
                colorID,
                size,
                stock,
                SKU
            });

            await stockItem.save();

            res.status(201).json({
                message: 'Thêm size và số lượng tồn kho thành công',
                stockItem
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi thêm size và số lượng tồn kho',
                error: error.message
            });
        }
    }

    // ADMIN: Cập nhật số lượng tồn kho
    async updateStock(req, res) {
        try {
            const { SKU } = req.params;
            const { stock } = req.body;

            const stockItem = await ProductSizeStock.findOne({ SKU });
            if (!stockItem) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin tồn kho' });
            }

            stockItem.stock = stock;
            await stockItem.save();

            res.json({
                message: 'Cập nhật số lượng tồn kho thành công',
                stockItem
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật số lượng tồn kho',
                error: error.message
            });
        }
    }

    // ADMIN: Xóa size
    async deleteStock(req, res) {
        try {
            const { SKU } = req.params;

            const stockItem = await ProductSizeStock.findOne({ SKU });
            if (!stockItem) {
                return res.status(404).json({ message: 'Không tìm thấy thông tin tồn kho' });
            }

            // Kiểm tra có đơn hàng nào đang sử dụng size này không
            const OrderDetail = require('../models/OrderDetail');
            const ordersUsingStock = await OrderDetail.countDocuments({ SKU });
            if (ordersUsingStock > 0) {
                return res.status(400).json({
                    message: 'Không thể xóa size này vì đã có đơn hàng sử dụng'
                });
            }

            await stockItem.deleteOne();

            res.json({ message: 'Xóa size thành công' });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi xóa size',
                error: error.message
            });
        }
    }

    // ADMIN: Kiểm tra tồn kho hàng loạt
    async checkStockBatch(req, res) {
        try {
            const { items } = req.body; // Array of { SKU, quantity }

            const results = await Promise.all(items.map(async (item) => {
                const stockItem = await ProductSizeStock.findOne({ SKU: item.SKU })
                    .populate({
                        path: 'colorID',
                        populate: {
                            path: 'productID',
                            select: 'name'
                        }
                    });

                if (!stockItem) {
                    return {
                        SKU: item.SKU,
                        isAvailable: false,
                        message: 'Sản phẩm không tồn tại'
                    };
                }

                const isAvailable = stockItem.stock >= item.quantity;
                return {
                    SKU: item.SKU,
                    productName: stockItem.colorID.productID.name,
                    size: stockItem.size,
                    color: stockItem.colorID.name,
                    requestedQuantity: item.quantity,
                    availableStock: stockItem.stock,
                    isAvailable
                };
            }));

            res.json(results);
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi kiểm tra tồn kho',
                error: error.message
            });
        }
    }
}

module.exports = new ProductSizeStockController();
