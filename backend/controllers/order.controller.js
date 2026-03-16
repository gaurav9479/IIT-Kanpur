import orderService from "../services/order.service.js";
import asyncHandler from "../utils/AsyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body);
  return res.status(201).json(
    new ApiResponse(201, order, "Order created and drone assignment attempted")
  );
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getAllOrders();
  return res.status(200).json(
    new ApiResponse(200, orders, "Orders fetched successfully")
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  return res.status(200).json(
    new ApiResponse(200, order, "Order fetched successfully")
  );
});

export const updateOrder = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrder(req.params.id, req.body);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  return res.status(200).json(
    new ApiResponse(200, order, "Order updated successfully")
  );
});
