import { expect, test } from "@playwright/test";

const product = {
  _id: "product-1",
  name: "Test Apple",
  slug: "test-apple",
  description: "Crisp apples for testing the storefront.",
  category: { _id: "category-1", name: "Fresh Produce", slug: "fresh-produce", icon: "apple", order: 1 },
  price: 120,
  compareAtPrice: 150,
  unit: "1 kg",
  image: "http://kokwet-groceries-api.onrender.com/uploads/test-apple.jpg",
  images: ["http://kokwet-groceries-api.onrender.com/uploads/test-apple.jpg"],
  stock: 12,
  lowStockThreshold: 5,
  dietaryLifestyle: [],
  isFeatured: true,
  isActive: true,
  ratingAverage: 0,
  ratingCount: 0,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/\/+$/, "");
    let data: unknown = {};

    if (pathname.endsWith("/products/promotions")) {
      data = { newArrivals: [], trending: [], megaSales: [] };
    } else if (pathname.endsWith("/products/test-apple")) {
      data = { product, related: [] };
    } else if (pathname.endsWith("/products")) {
      data = {
        products: url.searchParams.get("featured") === "true" ? [product] : [],
        page: 1,
        pages: 1,
        total: 1,
        facets: { brands: [], dietaryLifestyle: [], categories: [] },
      };
    } else if (pathname.endsWith("/categories")) {
      data = [];
    } else if (pathname.endsWith("/settings")) {
      data = {};
    } else if (pathname.endsWith("/cart")) {
      data = [];
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.route("**/uploads/test-apple.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#eef6e8"/><circle cx="320" cy="210" r="130" fill="#db3f32"/><path d="M320 80c-25-50 35-70 60-45" fill="none" stroke="#347a34" stroke-width="16"/></svg>',
    });
  });
});

test("storefront renders product and image click opens a well-fitted enlarged image", async ({ page }) => {
  await page.goto("/");

  const productLink = page.getByRole("link", { name: /test apple/i }).first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page.getByRole("heading", { name: "Test Apple" })).toBeVisible();

  const productImage = page.getByRole("img", { name: "Test Apple" }).first();
  await expect(productImage).toBeVisible();
  await expect(productImage).toHaveAttribute("src", /^https:\/\/kokwet-groceries-api\.onrender\.com\/uploads\/test-apple\.jpg$/);
  await expect(productImage).toHaveCSS("object-fit", "contain");
  await productImage.click();

  const imageDialog = page.getByRole("dialog", { name: "Test Apple" });
  await expect(imageDialog).toBeVisible();
  const enlargedImage = imageDialog.getByRole("img", { name: "Test Apple" });
  await expect(enlargedImage).toBeVisible();
  await expect(enlargedImage).toHaveJSProperty("naturalWidth", 640);
  await expect(enlargedImage).toHaveJSProperty("naturalHeight", 420);
  await expect(enlargedImage).toHaveCSS("object-fit", "contain");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(imageDialog).toBeHidden();
});

test("product detail adds an item to cart and shows it in the cart drawer", async ({ page }) => {
  await page.goto("/product/test-apple");
  await expect(page.getByRole("heading", { name: "Test Apple" })).toBeVisible();

  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText("Test Apple").last()).toBeVisible();
  await expect(page.getByText(/KSh\s?120/i).last()).toBeVisible();
  const cartImage = page.getByRole("img", { name: "Test Apple" }).last();
  await expect(cartImage).toHaveAttribute("src", /^https:\/\/kokwet-groceries-api\.onrender\.com\/uploads\/test-apple\.jpg$/);
  await expect(cartImage).toHaveCSS("object-fit", "contain");
});

test("product quick view displays the full image without cropping", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Test Apple" }).first();
  await expect(card.getByRole("img", { name: "Test Apple" })).toHaveCSS("object-fit", "contain");
  await page.getByRole("button", { name: /quick view test apple/i }).click();

  const dialog = page.getByRole("dialog", { name: "Test Apple" });
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole("img", { name: "Test Apple" });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("naturalWidth", 640);
  await expect(image).toHaveJSProperty("naturalHeight", 420);
  await expect(image).toHaveCSS("object-fit", "contain");
  await expect(dialog.getByRole("link", { name: "View details" })).toBeVisible();
});

test("mobile quick view keeps the complete dialog content within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /quick view test apple/i }).click();

  const dialog = page.getByRole("dialog", { name: "Test Apple" });
  await expect(dialog).toBeVisible();
  const dimensions = await dialog.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.left, JSON.stringify(dimensions)).toBeGreaterThanOrEqual(0);
  expect(dimensions.right, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("product image fits on a mobile viewport and opens at full size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/product/test-apple");
  await expect(page.getByRole("heading", { name: "Test Apple" })).toBeVisible();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(pageWidth).toBeLessThanOrEqual(viewportWidth);

  const image = page.getByRole("img", { name: "Test Apple" }).first();
  await expect(image).toHaveCSS("object-fit", "contain");
  await image.click();

  const dialog = page.getByRole("dialog", { name: "Test Apple" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Test Apple" })).toHaveCSS("object-fit", "contain");
});

test("search page accepts a query and renders without frontend errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/search?q=apples");
  await expect(page.getByRole("main").nth(1)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("checkout explains STK Push and shows the Pochi receiving number", async ({ page }) => {
  await page.addInitScript((item) => localStorage.setItem("kokwet_cart", JSON.stringify([{ product: item, quantity: 1 }])), product);
  await page.goto("/checkout");
  await page.evaluate(() => localStorage.setItem("kokwet_user", JSON.stringify({
    _id: "customer-1",
    name: "Test Customer",
    email: "customer@example.test",
    phone: "0712345678",
    role: "customer",
    addresses: [],
    token: "test-token",
  })));
  await page.reload();

  await expect(page.getByText("M-Pesa · Pochi la Biashara")).toBeVisible();
  await expect(page.getByText(/STK Push will be sent to your delivery phone.*0793048318/)).toBeVisible();
  await expect(page.getByText("Confirm the M-Pesa prompt on your phone to complete payment.")).toBeVisible();
});
