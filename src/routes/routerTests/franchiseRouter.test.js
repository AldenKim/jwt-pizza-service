const request = require("supertest");
const app = require("../../service.js");
const { Role, DB } = require("../../database/database.js");

let adminUser;
let adminAuthToken;
let testFranchise;
let testUserAuthToken;
const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}

beforeAll(async () => {
  //Create admin user
  adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send({
    email: adminUser.email,
    password: adminUser.password,
  });
  adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);

  // Create regular user
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // Create a franchise for testing
  const franchisePayload = {
    name: randomName() + "franchise",
    admins: [{ email: adminUser.email }],
  };
  const franchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(franchisePayload);
  testFranchise = franchiseRes.body;
});

afterAll(async () => {
  // Clean up test franchise
  await DB.deleteFranchise(testFranchise.id);
});

test("get franchises as regular user", async () => {
  const getFranchisesRes = await request(app)
    .get(`/api/franchise?name=${testFranchise.name}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(getFranchisesRes.status).toBe(200);
  expect(Array.isArray(getFranchisesRes.body.franchises)).toBe(true);
  expect(getFranchisesRes.body.franchises.length).toBeGreaterThan(0);
  expect(getFranchisesRes.body.franchises).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: testFranchise.name }),
    ]),
  );
});

test("get user franchises", async () => {
  const getUserFranchisesRes = await request(app)
    .get(`/api/franchise/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminAuthToken}`);

  expect(getUserFranchisesRes.status).toBe(200);
  expect(Array.isArray(getUserFranchisesRes.body)).toBe(true);
  expect(getUserFranchisesRes.body.length).toBeGreaterThan(0);
  expect(getUserFranchisesRes.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: testFranchise.name }),
    ]),
  );
});

test("create franchise", async () => {
  const franchisePayload = {
    name: randomName() + "franchisetest",
    admins: [{ email: adminUser.email }],
  };

  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(franchisePayload);
  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body).toMatchObject({
    name: franchisePayload.name,
  });
  // Clean up franchise
  await DB.deleteFranchise(createFranchiseRes.body.id);
});

test("create franchise bad request", async () => {
  const franchisePayload = {
    name: randomName() + "franchisetest",
    admins: [{ email: "nonexistent@example.com" }],
  };

  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(franchisePayload);
  expect(createFranchiseRes.status).toBe(404);
  expect(createFranchiseRes.body.message).toBe(
    `unknown user for franchise admin ${franchisePayload.admins[0]?.email} provided`,
  );
});

test("create franchise non admin", async () => {
  const franchisePayload = {
    name: randomName() + "franchisetest",
    admins: [{ email: testUser.email }],
  };

  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(franchisePayload);

  expect(createFranchiseRes.status).toBe(403);
  expect(createFranchiseRes.body.message).toBe("unable to create a franchise");
});

test("delete franchise", async () => {
  const franchisePayload = {
    name: randomName() + "franchisetest",
    admins: [{ email: adminUser.email }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(franchisePayload);

  const deleteFranchiseRes = await request(app)
    .delete(`/api/franchise/${createFranchiseRes.body.id}`)
    .set("Authorization", `Bearer ${adminAuthToken}`);

  expect(deleteFranchiseRes.status).toBe(200);
  expect(deleteFranchiseRes.body.message).toBe("franchise deleted");
});

test("create store in franchise", async () => {
  const storePayload = {
    franchiseId: testFranchise.id,
    name: randomName() + "storetest",
  };

  const createStoreRes = await request(app)
    .post("/api/franchise/" + testFranchise.id + "/store")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(storePayload);

  expect(createStoreRes.status).toBe(200);
  expect(createStoreRes.body.name).toBe(storePayload.name);
  expect(createStoreRes.body.franchiseId).toBe(testFranchise.id);

  // Clean up store in franchise
  await DB.deleteStore(testFranchise.id, createStoreRes.body.id);
});

test("create store in franchise non admin", async () => {
  const storePayload = {
    franchiseId: testFranchise.id,
    name: randomName() + "storetest",
  };

  const createStoreRes = await request(app)
    .post("/api/franchise/" + testFranchise.id + "/store")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(storePayload);

  expect(createStoreRes.status).toBe(403);
  expect(createStoreRes.body.message).toBe("unable to create a store");
});

test("delete store in franchise", async () => {
  const storePayload = {
    franchiseId: testFranchise.id,
    name: randomName() + "storetest",
  };

  const createStoreRes = await request(app)
    .post("/api/franchise/" + testFranchise.id + "/store")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(storePayload);

  const deleteStoreRes = await request(app)
    .delete(
      `/api/franchise/${testFranchise.id}/store/${createStoreRes.body.id}`,
    )
    .set("Authorization", `Bearer ${adminAuthToken}`);

  expect(deleteStoreRes.status).toBe(200);
  expect(deleteStoreRes.body.message).toBe("store deleted");
});

test("delete store in franchise bad", async () => {
  const storePayload = {
    franchiseId: testFranchise.id,
    name: randomName() + "storetest",
  };

  const createStoreRes = await request(app)
    .post("/api/franchise/" + testFranchise.id + "/store")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(storePayload);

  const deleteStoreRes = await request(app)
    .delete(
      `/api/franchise/${testFranchise.id}/store/${createStoreRes.body.id}`,
    )
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(deleteStoreRes.status).toBe(403);
  expect(deleteStoreRes.body.message).toBe("unable to delete a store");
});
