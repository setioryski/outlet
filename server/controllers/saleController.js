// setioryski/outlet/outlet-3cfbd4fa53e575bcae4fd49c3caa4637028d3653/server/controllers/saleController.js

const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

// @desc    Get all selling products
// @route   GET /api/sales/allselling
// @access  Private/Admin
exports.getAllSellingProducts = async (req, res) => {
  try {
    const allSellingProducts = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalQuantity: -1 } },
    ]);
    res.json(allSellingProducts);
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

// @desc    Get top selling products
// @route   GET /api/sales/topproducts
// @access  Private/Admin
exports.getTopProducts = async (req, res) => {
  try {
    const topProducts = await Sale.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);
    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private
exports.addSale = async (req, res) => {
  const { items, totalAmount, paymentMethod, customerId } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const productIds = items.map(item => item.productId);
    const products = await Product.find({ '_id': { $in: productIds } }).session(session);

    if (customerId) {
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) {
            throw new Error(`Customer with id ${customerId} not found.`);
        }
    }

    const saleItems = items.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        if (!product) {
            throw new Error(`Product with id ${item.productId} not found.`);
        }
        return {
            ...item,
            basePrice: product.basePrice
        };
    });

    // Create the sale record
    const sale = new Sale({
      items: saleItems,
      cashierId: req.user._id,
      customerId,
      totalAmount,
      paymentMethod,
      status: 'Completed',
    });
    const createdSale = await sale.save({ session });

    // Decrease stock for each product
    for (const item of saleItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      }, { session });
    }

    await session.commitTransaction();

    // Populate cashier info for the response
    const populatedSale = await Sale.findById(createdSale._id)
        .populate('cashierId', 'username')
        .populate('customerId', 'name phone');
    res.status(201).json(populatedSale);

  } catch (error) {
    await session.abortTransaction();
    console.error(`Sale creation error: ${error.message}`);
    res.status(500).json({ message: `Server Error: ${error.message}` });
  } finally {
    session.endSession();
  }
};


// @desc    Retract a sale
// @route   PUT /api/sales/:id/retract
// @access  Private/Admin
exports.retractSale = async (req, res) => {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
        return res.status(404).json({ message: 'Sale not found' });
    }

    if (sale.status === 'Retracted') {
        return res.status(400).json({ message: 'Sale has already been retracted' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Restore stock for each item in the sale
        for (const item of sale.items) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: +item.quantity }
            }, { session });
        }

        // Update the sale status
        sale.status = 'Retracted';
        const updatedSale = await sale.save({ session });

        await session.commitTransaction();

        const populatedSale = await Sale.findById(updatedSale._id).populate('cashierId', 'username');
        res.json(populatedSale);

    } catch (error) {
        await session.abortTransaction();
        console.error(`Sale retraction error: ${error.message}`);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    } finally {
        session.endSession();
    }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private/Admin
exports.getSales = async (req, res) => {
  try {
    // --- MODIFIED FILTER LOGIC ---
    const { cashierId, startDate, endDate } = req.query;
    const filter = {};
    if (cashierId) {
        filter.cashierId = cashierId;
    }

    // Add date range filtering
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0); // Set to start of the day
            filter.createdAt.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Set to end of the day
            filter.createdAt.$lte = end;
        }
    }
    // --- END OF MODIFIED LOGIC ---

    const sales = await Sale.find(filter).sort({ createdAt: -1 }) // Use filter object
        .populate('cashierId', 'username')
        .populate('customerId', 'name');
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

// @desc    Get sale by ID
// @route   GET /api/sales/:id
// @access  Private/Admin
exports.getSaleById = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id)
            .populate('cashierId', 'username')
            .populate('items.productId', 'sku')
            .populate('customerId', 'name phone address');
        if (sale) {
            res.json(sale);
        } else {
            res.status(404).json({ message: 'Sale not found' });
        }
    } catch (error) {
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
};

// @desc    Delete a sale
// @route   DELETE /api/sales/:id
// @access  Private/Admin
exports.deleteSale = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (sale) {
            // Note: This is a hard delete and does NOT return stock.
            // Use 'retractSale' if you need to manage inventory.
            await sale.deleteOne();
            res.json({ message: 'Sale removed' });
        } else {
            res.status(404).json({ message: 'Sale not found' });
        }
    } catch (error) {
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
};

// @desc    Get sales for the current day (filtered by cashier)
// @route   GET /api/sales/today
// @access  Private
exports.getTodaysSales = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build the query
    const query = {
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
      status: 'Completed',
    };

    // If the user is a Cashier, only show their sales
    if (req.user.role === 'Cashier') {
      query.cashierId = req.user._id;
    }
    // Admins will not have the cashierId filter, so they see all sales

    const sales = await Sale.find(query).sort({ createdAt: -1 })
      .populate('cashierId', 'username')
      .populate('customerId', 'name');

    const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);

    res.json({ sales, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};