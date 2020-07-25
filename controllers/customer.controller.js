const UserModel = require("../models/store_admin");
const StoreModel = require("../models/store");
const Transaction = require("../models/transaction");
const Debts = require("../models/debt_reminders");
const { body } = require("express-validator/check");
const Customer = require("../models/customer");
const { errorHandler } = require("./login_controler");

const transactionService = {
  getDebts: (params) => {
    return Debts.find(params);
  },
  getTransactions: async (params) => {
    let transactions = await Transaction.find(params);
    transactions = await Promise.all(
      transactions.map(async (transaction) => {
        transaction = transaction.toObject();
        const debts = await transactionService.getDebts({
          trans_ref_id: transaction._id,
        });
        return { ...transaction, debts };
      })
    );
    return transactions;
  },
};

const customerService = {
  getCustomers: async (params) => {
    let customers = await Customer.find(params);
    customers = await Promise.all(
      customers.map(async (customer) => {
        customer = customer.toObject();
        let transactions = await transactionService.getTransactions({
          customer_ref_id: customer._id,
        });
        return { ...customer, transactions };
      })
    );
    return customers;
  },
};

exports.transactionService = transactionService;
exports.customerService = customerService;

exports.validate = (method) => {
  switch (method) {
    case "body": {
      return [body("name").isLength({ min: 3 })];
    }
  }
};

exports.create = async (req, res) => {
  const { phone_number, email, name, store_id } = req.body;
  try {
    let store;
    if ((req.user.user_role = "super_admin")) {
      store = await StoreModel.findOne({
        _id: store_id,
      });
    } else {
      store = await StoreModel.findOne({
        _id: store_id,
        store_admin_ref: req.user.store_admin_ref,
      });
    }
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
        error: {
          statusCode: 404,
        },
      });
    }

    let customer = await Customer.findOne({
      phone_number,
      store_ref_id: store_id,
    });
    if (customer) {
      return res.status(409).json({
        sucess: false,
        message: "Customer already registered",
        data: {
          statusCode: 409,
        },
      });
    }
    customer = await Customer.create({
      phone_number,
      store_ref_id: store_id,
      name,
      email,
    });
    return res.status(201).json({
      success: true,
      message: "Customer registration successful",
      data: {
        statusCode: 201,
        customer,
      },
    });
  } catch (error) {
    errorHandler(error, res);
  }
};

exports.getById = async (req, res) => {
  try {
    let store = await StoreModel.findOne({
      _id: req.params.storeId,
      store_admin_ref: req.user.store_admin_ref,
    });
    if (!store) {
      return res.status(404).json({
        status: false,
        message: "store not found",
        error: {
          statusCode: 404,
          message: "store not found",
        },
      });
    }
    let customer = await Customer.findOne({
      store_ref_id: store._id,
      _id: req.params.customerId,
    });
    if (!customer) {
      return res.status(404).json({
        status: false,
        message: "Customer not found",
        error: {
          statusCode: 404,
          message: "customer not found",
        },
      });
    }
    return res.status(200).json({
      success: true,
      message: "successful",
      data: {
        statusCode: 200,
        customer,
        storeName: store.store_name,
        storeId: store._id,
      },
    });
  } catch (error) {
    return errorHandler(error, res);
  }
};

exports.updateById = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const { name, phone_number, email, store_id } = req.body;
    let store = await StoreModel.findOne({
      _id: store_id,
      store_admin_ref: req.user.store_admin_ref,
    });
    if (!store) {
      return res.status(404).json({
        status: false,
        message: "store not found",
        error: {
          statusCode: 404,
          message: "store not found",
        },
      });
    }
    let customer = await Customer.findOne({
      store_ref_id: store._id,
      _id: customerId,
    });
    if (!customer) {
      return res.status(404).json({
        status: false,
        message: "Cannot find customer",
        error: {
          statusCode: 404,
          message: error,
        },
      });
    }
    customer.name = req.body.name || customer.name;
    customer.phone_number = req.body.phone_number || customer.phone_number;
    customer.email = req.body.email || customer.email;
    customer = await customer.save();
    return res.status(200).json({
      success: true,
      message: "Customer updated successfully.",
      data: {
        statusCode: 200,
        customer,
      },
    });
  } catch (error) {
    return errorHandler(error, res);
  }
};

exports.deleteById = async (req, res) => {
  try {
    let customer = await Customer.findOne({
      _id: req.params.customerId,
    }).populate({ path: "store_ref_id" });
    if (
      !customer ||
      (req.user._id.toString() !==
        customer.store_ref_id.store_admin_ref.toString() &&
        req.user._id.toString() !==
          (customer.store_ref_id.assistant &&
            customer.store_ref_id.assistant.toString()))
    ) {
      return res.status(404).json({
        status: false,
        message: "Cannot find customer",
        error: {
          statusCode: 404,
          customer,
        },
      });
    }
    await customer.remove();
    return res.status(200).json({
      success: true,
      message: "Customer deleted successful",
      data: {
        statusCode: 200,
      },
    });
  } catch (error) {
    return errorHandler(error, res);
  }
};

exports.getAll = async (req, res) => {
  try {
    let stores;
    if (req.user.user_role === "super_admin") {
      stores = await StoreModel.find({});
    } else {
      stores = await StoreModel.find({
        store_admin_ref: req.user.store_admin_ref,
      });
    }
    const customer = await Promise.all(
      stores.map(async (store) => {
        const customers = await Customer.find({ store_ref_id: store._id });
        return {
          storeName: store.store_name,
          storeId: store._id,
          customers,
        };
      })
    );
    return res.status(200).json({
      success: true,
      message: "Operation successful",
      data: {
        statusCode: 200,
        customer,
      },
    });
  } catch (error) {
    return errorHandler(error, res);
  }
};

exports.allCustomers = async (req, res) => {
  let role = req.user.user_role;
  try {
    if (role !== "super_admin") {
      return res.status(401).json({
        success: false,
        message: "Unauthorised! Only Super Admin can Update Complaint!",
      });
    }
    let customers = await customerService.getCustomers({});
    return res.status(200).json({
      success: true,
      message: "Operation successful",
      data: {
        statusCode: 200,
        customers,
      },
    });
  } catch (err) {
    return errorHandler(err, res);
  }
};
