import jwt from "jsonwebtoken"
import User from "../models/User.model.js"
import asyncHandler from "../utils/AsyncHandler.js"
import ApiError from "../utils/ApiError.js"

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      throw new ApiError(401, "Not authorized, token failed");
    }
  }

  if (!token) {
    throw new ApiError(401, "Not authorized, no token");
  }
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `You do not have permission to perform this action. Required: ${roles.join(" or ")}`);
    }
    next();
  };
};

export { protect, restrictTo };
