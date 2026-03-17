import winston from "winston";
import { AsyncLocalStorage } from "async_hooks";

const logContext = new AsyncLocalStorage();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => {
        const context = logContext.getStore();
        if (context && context.correlationId) {
            info.correlationId = context.correlationId;
        }
        return info;
    })(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
      ),
    })
  );
}

export { logContext };
export default logger;
