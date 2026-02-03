const request = require("supertest");
const createService = require("../../service.js");
const { DBClass } = require("../../database/database.js");

let app;
let testDB;

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testDB = new DBClass("pizza_test_auth");
  await testDB.initialized;

  app = createService(testDB);

  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

afterAll(async () => {
  await testDB.close();
  await testDB.dropDatabase();
});

test("register", async () => {
  const newUser = {
    name: "new diner",
    email: Math.random().toString(36).substring(2, 12) + "@test.com",
    password: "a",
  };
  const registerRes = await request(app).post("/api/auth").send(newUser);
  expect(registerRes.status).toBe(200);
  expectValidJwt(registerRes.body.token);
});

test("register bad request", async () => {
  const badUser = { name: "bad diner", email: undefined, password: "a" };
  const registerRes = await request(app).post("/api/auth").send(badUser);
  expect(registerRes.status).toBe(400);
  expect(registerRes.body.message).toBe(
    "name, email, and password are required",
  );
});

test("unauthorized access for missing token", async () => {
  const res = await request(app).delete("/api/auth");

  expect(res.status).toBe(401);
  expect(res.body.message).toBe("unauthorized");
});

test("unauthorized access for tampered token", async () => {
  const tamperedToken = testUserAuthToken.slice(0, -1) + "a";

  const res = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${tamperedToken}`);

  expect(res.status).toBe(401);
  expect(res.body.message).toBe("unauthorized");
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("login with wrong password", async () => {
  const wrongPasswordUser = { ...testUser, password: "wrongpassword" };
  const loginRes = await request(app).put("/api/auth").send(wrongPasswordUser);
  expect(loginRes.status).toBe(404);
  expect(loginRes.body.message).toBe("unknown user");
});

test("logout", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}
