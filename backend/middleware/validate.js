import ApiError from "../utils/ApiError.js";

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    const errorMessage = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
    next(new ApiError(400, errorMessage));
  }
};

export default validate;
