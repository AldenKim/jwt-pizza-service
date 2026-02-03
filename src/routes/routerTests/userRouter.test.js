const request = require("supertest");
const createService = require("../../service.js");
const { DBClass } = require("../../database/database.js");

let app;
let testDB;

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testDB = new DBClass("pizza_test_user");
  await testDB.initialized;

  app = createService(testDB);

  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);
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

test("list users (not implemented)", async () => {
  const listUsersRes = await request(app)
    .get(`/api/user/`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body.message).toBe("not implemented");
});
