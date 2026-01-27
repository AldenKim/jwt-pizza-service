const request = require("supertest");
const app = require("../../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
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

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
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
