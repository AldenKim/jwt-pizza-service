import { sleep, check, group, fail } from "k6";
import http from "k6/http";
import jsonpath from "https://jslib.k6.io/jsonpath/1.0.2/index.js";

export const options = {
  cloud: {
    distribution: {
      "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
    },
    apm: [],
  },
  thresholds: {},
  scenarios: {
    Login_and_Purchase: {
      executor: "ramping-vus",
      gracefulStop: "30s",
      stages: [
        { target: 5, duration: "30s" },
        { target: 15, duration: "1m" },
        { target: 10, duration: "30s" },
        { target: 0, duration: "30s" },
      ],
      gracefulRampDown: "30s",
      exec: "login_and_Purchase",
    },
  },
};

export function login_and_Purchase() {
  let response;

  const vars = {};

  group("Home Page - https://pizza.aldenkim.click/", function () {
    // Login
    response = http.put(
      "https://pizza-service.aldenkim.click/api/auth",
      '{"email":"d@jwt.com","password":"diner"}',
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.5",
          "content-type": "application/json",
          origin: "https://pizza.aldenkim.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          "sec-gpc": "1",
        },
      },
    );
    if (
      !check(response, {
        "status equals 200": (response) => response.status.toString() === "200",
      })
    ) {
      console.log(response.body);
      fail("Login was *not* 200");
    }

    vars["token"] = jsonpath.query(response.json(), "$.token")[0];

    sleep(3);

    // Get Menu
    response = http.get("https://pizza-service.aldenkim.click/api/order/menu", {
      headers: {
        accept: "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.5",
        authorization: `Bearer ${vars["token"]}`,
        "content-type": "application/json",
        "if-none-match": 'W/"1fc-cgG/aqJmHhElGCplQPSmgl2Gwk0"',
        origin: "https://pizza.aldenkim.click",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "sec-gpc": "1",
      },
    });

    // Get Franchises
    response = http.get(
      "https://pizza-service.aldenkim.click/api/franchise?page=0&limit=20&name=*",
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.5",
          authorization: `Bearer ${vars["token"]}`,
          "content-type": "application/json",
          "if-none-match": 'W/"5c-UrU6FPurLC0JcnOrzddwdfUXFBA"',
          origin: "https://pizza.aldenkim.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          "sec-gpc": "1",
        },
      },
    );
    sleep(2);

    // Order
    response = http.post(
      "https://pizza-service.aldenkim.click/api/order",
      '{"items":[{"menuId":1,"description":"Veggie","price":0.0038},{"menuId":4,"description":"Crusty","price":0.0028},{"menuId":3,"description":"Margarita","price":0.0042},{"menuId":2,"description":"Pepperoni","price":0.0042}],"storeId":"1","franchiseId":1}',
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.5",
          authorization: `Bearer ${vars["token"]}`,
          "content-type": "application/json",
          origin: "https://pizza.aldenkim.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          "sec-gpc": "1",
        },
      },
    );
    if (
      !check(response, {
        "status equals 200": (response) => response.status.toString() === "200",
      })
    ) {
      console.log(response.body);
      fail("Login was *not* 200");
    }
    sleep(2);

    vars["jwt"] = jsonpath.query(response.json(), "$.jwt")[0];

    // Verify JWT
    response = http.post(
      "https://pizza-factory.cs329.click/api/order/verify",
      JSON.stringify({ jwt: vars["jwt"] }),
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.5",
          authorization: `Bearer ${vars["token"]}`,
          "content-type": "application/json",
          origin: "https://pizza.aldenkim.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          "sec-fetch-storage-access": "none",
          "sec-gpc": "1",
        },
      },
    );

    if (
      !check(response, {
        "JWT is valid": (r) =>
          r.status === 200 && r.json().report?.valid === true,
      })
    ) {
      console.log(`JWT Verification Failed: ${response.body}`);
      fail("JWT verification failed");
    }
  });
}
