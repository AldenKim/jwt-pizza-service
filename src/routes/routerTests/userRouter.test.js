const request = require("supertest");
const createService = require("../../service.js");
const { DBClass } = require("../../database/database.js");

let app;
let testDB;

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let adminToken;

beforeAll(async () => {
  testDB = new DBClass("pizza_test_user");
  await testDB.initialized;

  app = createService(testDB);

  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);

  const loginRes = await request(app)
    .put("/api/auth") // Assuming PUT is your login endpoint
    .send({ email: "a@jwt.com", password: "admin" });

  adminToken = loginRes.body.token;
  expectValidJwt(adminToken);
});

afterAll(async () => {
  await testDB.close();
  await testDB.dropDatabase();
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}

async function registerUser(service) {
  const testUser = {
    name: "pizza diner",
    email: `${randomName()}@test.com`,
    password: "a",
  };
  const registerRes = await service.post("/api/auth").send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

test("get user", async () => {
  const getUserRes = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(getUserRes.status).toBe(200);
  expect(getUserRes.body.email).toBe(testUser.email);
  expect(getUserRes.body.name).toBe(testUser.name);
});

test("update user", async () => {
  const updatedName = "UpdatedName";

  const updateUserRes = await request(app)
    .put(`/api/user/${testUser.id}`)
    .send({
      name: updatedName,
      email: testUser.email,
      password: testUser.password,
    })
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(updateUserRes.status).toBe(200);
  expect(updateUserRes.body.user.name).toBe(updatedName);
  expect(updateUserRes.body.user.email).toBe(testUser.email);
  expect(updateUserRes.body.user.id).toBe(testUser.id);
});

test("unauthorized update user", async () => {
  const updatedName = "UpdatedName";

  const updateUserRes = await request(app)
    .put(`/api/user/badId`)
    .send({
      name: updatedName,
      email: testUser.email,
      password: testUser.password,
    })
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(updateUserRes.status).toBe(403);
  expect(updateUserRes.body.message).toBe("unauthorized");
});

test("delete user (not implemented)", async () => {
  const deleteUserRes = await request(app)
    .delete(`/api/user/${testUser.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(deleteUserRes.status).toBe(200);
  expect(deleteUserRes.body.message).toBe("not implemented");
});

test("list users unauthorized", async () => {
  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + testUserAuthToken);

  expect(listUsersRes.status).toBe(403);
  expect(listUsersRes.body.message).toBe("unauthorized");
});

test("list users", async () => {
  const [user] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + adminToken);

  expect(listUsersRes.body.users.length).toBeGreaterThan(0);
  expect(listUsersRes.body.users.some((u) => u.email === user.email)).toBe(
    true,
  );
  expect(listUsersRes.body.users.some((u) => u.name === user.name)).toBe(true);
  expect(listUsersRes.status).toBe(200);
});

test("test list users pagination", async () => {
  const userCount = 11;
  for (let i = 0; i < userCount; i++) {
    await registerUser(request(app));
  }

  const limit = 10;
  const listUsersRes = await request(app)
    .get(`/api/user?page=1&limit=${limit}`)
    .set("Authorization", "Bearer " + adminToken);

  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.users.length).toBe(limit);

  const page2Res = await request(app)
    .get(`/api/user?page=2&limit=${limit}`)
    .set("Authorization", "Bearer " + adminToken);

  expect(page2Res.status).toBe(200);
  expect(page2Res.body.users.length).toBeGreaterThanOrEqual(1);
});

test("list users with name filter", async () => {
  const uniqueName = "SpecialUser" + Math.random().toString(36).substring(2, 7);
  const otherName = "CommonDiner";

  // Create a user with a unique name
  await request(app).post("/api/auth").send({
    name: uniqueName,
    email: `special@test.com`,
    password: "a",
  });

  // Create a user with a common name
  await request(app).post("/api/auth").send({
    name: otherName,
    email: `other@test.com`,
    password: "a",
  });

  const filter = "Special*";
  const listUsersRes = await request(app)
    .get(`/api/user?name=${filter}`)
    .set("Authorization", "Bearer " + adminToken);

  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.users.length).toBeGreaterThanOrEqual(1);
  expect(listUsersRes.body.users.some((u) => u.name === uniqueName)).toBe(true);
  expect(listUsersRes.body.users.some((u) => u.name === otherName)).toBe(false);
});
