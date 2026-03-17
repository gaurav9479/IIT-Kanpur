import ApiError from "../utils/ApiError.js";

const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        // Detailed Zod error formatting
        const errorMessage = error.errors
            .map((err) => `${err.path.join(".")}: ${err.message}`)
            .join(" | ");
            
        throw new ApiError(400, `Schema Validation Failed: ${errorMessage}`);
    }
};

export default validate;
