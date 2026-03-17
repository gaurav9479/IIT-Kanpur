import { v4 as uuidv4 } from "uuid";
import { logContext } from "../utils/logger.js";

const correlationIdMiddleware = (req, res, next) => {
    const correlationId = req.header("x-correlation-id") || uuidv4();
    req.correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    
    logContext.run({ correlationId }, () => next());
};

export default correlationIdMiddleware;
