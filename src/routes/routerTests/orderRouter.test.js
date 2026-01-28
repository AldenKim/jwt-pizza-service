const request = require("supertest");
const app = require("../../service.js");
const { Role, DB } = require("../../database/database.js");

let adminUser;
let adminAuthToken;
let testUserAuthToken;
const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

async function createTestFranchiseAndStore() {
  const testFranchise = await DB.createFranchise({
    name: randomName(),
    admins: [{ email: adminUser.email }],
  });

  const testStore = await DB.createStore(testFranchise.id, {
    franchiseId: testFranchise.id,
    name: "Test Store",
  });

  return { testFranchise, testStore };
}

async function deleteTestFranchiseAndStore(franchise, store) {
  await DB.deleteStore(franchise.id, store.id);
  await DB.deleteFranchise(franchise.id);
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
});

test("get menu test", async () => {
  const menuRes = await request(app).get("/api/order/menu");

  expect(menuRes.status).toBe(200);
  expect(Array.isArray(menuRes.body)).toBe(true);
  expect(menuRes.body.length).toBeGreaterThanOrEqual(0);
});

test("add menu item as admin", async () => {
  const newMenuItem = {
    title: randomName(),
    description: randomName(),
    image: "none.png",
    price: 1.5,
  };

  const addRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send(newMenuItem);

  expect(addRes.status).toBe(200);
  expect(Array.isArray(addRes.body)).toBe(true);
  const addedItem = addRes.body.find(
    (item) => item.description === newMenuItem.description,
  );
  expect(addedItem).toBeDefined();
  expect(addedItem.price).toBe(newMenuItem.price);
});

test("add menu item non-admin", async () => {
  const newMenuItem = {
    title: randomName(),
    description: randomName(),
    image: "none.png",
    price: 1.5,
  };

  const addRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(newMenuItem);

  expect(addRes.status).toBe(403);
  expect(addRes.body.message).toBe("unable to add menu item");
});

test("create order", async () => {
  //Create test franchise and store
  const { testFranchise, testStore } = await createTestFranchiseAndStore();

  //Create and test order
  const testOrder = {
    franchiseId: testFranchise.id,
    storeId: testStore.id,
    items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
  };

  const orderRes = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testOrder);

  expect(orderRes.status).toBe(200);
  expect(orderRes.body).toHaveProperty("order");
  expect(orderRes.body.order).toHaveProperty("id");
  expect(orderRes.body.order.franchiseId).toBe(testFranchise.id);
  expect(orderRes.body.order.storeId).toBe(testStore.id);
  expect(Array.isArray(orderRes.body.order.items)).toBe(true);
  expect(orderRes.body.order.items.length).toBe(1);
  expect(orderRes.body.order.items[0].description).toBe("Veggie");
  expectValidJwt(orderRes.body.jwt);

  //Clean up
  await deleteTestFranchiseAndStore(testFranchise, testStore);
});

test("create order bad", async () => {
  //Create test franchise and store
  const { testFranchise, testStore } = await createTestFranchiseAndStore();

  //Create order
  const testOrder = {
    franchiseId: testFranchise.id,
    storeId: testStore.id,
    items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
  };

  const originalFetch = global.fetch;

  global.fetch = jest.fn().mockImplementation(() => {
    return {
      ok: false,
      json: async () => ({
        message: "Factory error",
        reportUrl: "http://test-url.com",
      }),
    };
  });

  const orderRes = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testOrder);

  expect(orderRes.status).toBe(500);
  expect(orderRes.body).toHaveProperty(
    "message",
    "Failed to fulfill order at factory",
  );
  expect(orderRes.body).toHaveProperty(
    "followLinkToEndChaos",
    "http://test-url.com",
  );

  //Clean up
  await deleteTestFranchiseAndStore(testFranchise, testStore);
  global.fetch = originalFetch;
});

test("get orders", async () => {
  //Create test franchise and store
  const { testFranchise, testStore } = await createTestFranchiseAndStore();

  //Create an order
  const testOrder = {
    franchiseId: testFranchise.id,
    storeId: testStore.id,
    items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
  };

  await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testOrder);

  //Get orders
  const getOrdersRes = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(getOrdersRes.status).toBe(200);
  expect(getOrdersRes.body).toHaveProperty("dinerId", expect.any(Number));
  expect(Array.isArray(getOrdersRes.body.orders)).toBe(true);
  expect(getOrdersRes.body.orders.length).toBeGreaterThan(0);
  expect(getOrdersRes.body.orders[0]).toHaveProperty("id");
  expect(getOrdersRes.body.orders[0]).toHaveProperty("items");
  expect(getOrdersRes.body.orders[0].items[0].description).toBe("Veggie");

  // Clean up
  await deleteTestFranchiseAndStore(testFranchise, testStore);
});
