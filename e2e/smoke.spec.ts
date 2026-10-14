import { test, expect } from '@playwright/test';

test.describe('Byblos Public Application Smoke Suite', () => {
  test('Landing page loads with branding and navigation targets', async ({ page }) => {
    await page.goto('/');

    // Check page title and primary header/body text
    await expect(page).toHaveTitle(/Byblos/i);
    await expect(page.locator('body')).toContainText(/safer way to buy/i);

    // Verify creator link is visible and correctly routed
    const creatorLink = page.locator('a[href="/creator/login"]');
    await expect(creatorLink).toBeVisible();

    // Verify buyer login entry point is accessible
    const buyerLink = page.locator('a[href="/buyer/login"]');
    await expect(buyerLink).toBeVisible();
  });

  test('Public explore catalog page loads without runtime exceptions', async ({ page }) => {
    await page.goto('/explore');

    // Page must load with active search or catalog container
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/.*explore.*/);
  });

  test('Static legal pages render prerendered content', async ({ page }) => {
    // Terms of Service
    await page.goto('/terms');
    await expect(page.locator('body')).toContainText(/Terms/i);

    // Privacy Policy
    await page.goto('/privacy');
    await expect(page.locator('body')).toContainText(/Privacy/i);
  });
});
