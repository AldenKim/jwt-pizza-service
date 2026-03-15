const config = require("./config");
const os = require("os");

// Metrics stored in memory
//request methods
const requests = {};
const reqMethods = new Set(["DELETE", "POST", "GET", "PUT"]);

// Pizza purchase info
let pizzasSold = 0;
let failedPurchases = 0;
let revenue = 0;
let pizzaPurchaseLatency = 0;

// for active users
let activeSessions = {};
const SESSION_TIMEOUT = 1 * 60 * 1000;

// for authentication attempts
let authSuccessCount = 0;
let authFailureCount = 0;

// service latency
let serviceLatency = 0;

// Middleware to track requests
function requestTracker(req, res, next) {
  const start = Date.now();
  const method = req.method;

  if (req.user && req.user.id) {
    activeSessions[req.user.id] = Date.now();
  }

  if (reqMethods.has(method)) {
    requests["all"] = (requests["all"] || 0) + 1;
    requests[method] = (requests[method] || 0) + 1;
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    serviceLatency = duration;
  });

  next();
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function addActiveUser(userId) {
  activeSessions[userId] = Date.now();
}

function removeUnactiveUser(userId) {
  delete activeSessions[userId];
}

function pizzaPurchase(success, latency, price, pizzaCount) {
  pizzaPurchaseLatency = latency;
  if (success) {
    pizzasSold += pizzaCount;
    revenue += price;
  } else {
    failedPurchases++;
  }
}

function recordAuth(success) {
  if (success) {
    authSuccessCount++;
  } else {
    authFailureCount++;
  }
}

// This will periodically send metrics to Grafana
setInterval(() => {
  const currTime = Date.now();
  Object.keys(activeSessions).forEach((userId) => {
    if (currTime - activeSessions[userId] > SESSION_TIMEOUT) {
      delete activeSessions[userId];
    }
  });

  const activeUserCount = Object.keys(activeSessions).length;

  const metrics = [];

  //Request methods
  Object.keys(requests).forEach((method) => {
    metrics.push(
      createMetric("requests", requests[method], "1", "sum", "asInt", {
        method,
      }),
    );
  });

  // CPU and memory metrics
  metrics.push(
    createMetric(
      "cpu_usage",
      getCpuUsagePercentage(),
      "%",
      "gauge",
      "asDouble",
    ),
  );

  metrics.push(
    createMetric(
      "memory_usage",
      getMemoryUsagePercentage(),
      "%",
      "gauge",
      "asDouble",
    ),
  );

  // Active Users
  metrics.push(
    createMetric("active_users", activeUserCount, "1", "gauge", "asInt"),
  );

  // Pizza purchase metrics
  metrics.push(
    createMetric("pizzas_sold", pizzasSold, "1", "sum", "asInt", {
      result: "success",
    }),
  );
  metrics.push(
    createMetric("creation_failures", failedPurchases, "1", "sum", "asInt", {
      result: "failure",
    }),
  );
  metrics.push(createMetric("revenue", revenue, "USD", "sum", "asDouble"));
  metrics.push(
    createMetric(
      "pizza_latency",
      pizzaPurchaseLatency,
      "ms",
      "gauge",
      "asDouble",
    ),
  );

  // Authentication attempts
  metrics.push(
    createMetric("auth_attempts", authSuccessCount, "1", "sum", "asInt", {
      result: "success",
    }),
  );

  metrics.push(
    createMetric("auth_attempts", authFailureCount, "1", "sum", "asInt", {
      result: "failure",
    }),
  );

  // Service Latency
  metrics.push(
    createMetric("service_latency", serviceLatency, "ms", "gauge", "asDouble"),
  );

  // pizzasSold = 0;
  // failedPurchases = 0;
  // revenue = 0;

  // authFailureCount = 0
  // authSuccessCount = 0;

  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes,
) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === "sum") {
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

module.exports = {
  requestTracker,
  pizzaPurchase,
  addActiveUser,
  removeUnactiveUser,
  recordAuth,
};
