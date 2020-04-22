import winston from "winston";

type WinstonWithSplat = {
  log: (type: string, ...args: any[]) => void;
};
winston.configure({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.simple()
      ),
      level: "silly",
    }),
  ],
});

const error = (...args: any[]) => {
  (winston as WinstonWithSplat).log("error", ...args);
};

const warn = (...args: any[]) => {
  (winston as WinstonWithSplat).log("warn", ...args);
};

const info = (...args: any[]) => {
  (winston as WinstonWithSplat).log("info", ...args);
};

const debug = (...args: any[]) => {
  (winston as WinstonWithSplat).log("debug", ...args);
};

export { error, warn, info, debug };
