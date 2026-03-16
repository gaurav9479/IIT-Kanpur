import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
} from "../controllers/order.controller.js";

import validate from "../middleware/validate.js";
import { orderSchema } from "../utils/validationSchemas.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect); // Secure all order routes

router.route("/")
  .post(validate(orderSchema), createOrder)
  .get(getAllOrders);

router.route("/:id")
  .get(getOrderById)
  .patch(updateOrder);

export default router;
