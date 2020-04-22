import winston from "winston";

winston.configure({
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
      level: "silly",
    }),
  ],
});

const error = (err: any) => {
  if (typeof err === "string") {
    return winston.error(err);
  }
  winston.error(err.stack || err.message || JSON.stringify(err, null, 2));
};

const warn = (warning: any) => {
  if (typeof warning === "string") {
    return winston.warn(warning);
  }
  winston.warn(
    warning.stack || warning.message || JSON.stringify(warning, null, 2)
  );
};

const info = (information: any) => {
  if (typeof information === "string") {
    return winston.info(information);
  }
  winston.info(
    information.stack ||
      information.message ||
      JSON.stringify(information, null, 2)
  );
};

const debug = (debug: any) => {
  if (typeof debug === "string") {
    return winston.info(debug);
  }
  winston.info(debug.stack || debug.message || JSON.stringify(debug, null, 2));
};

export { error, warn, info, debug };
