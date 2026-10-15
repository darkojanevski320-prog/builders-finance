import { expect, test } from '@playwright/test';
import { addExpense, nav, openDemo, tileCents, uniqueName } from './helpers';

test('opens a private demo copy with sample numbers', async ({ page }) => {
  await openDemo(page);
  expect(await tileCents(page, 'income')).toBeGreaterThan(0);
  expect(await tileCents(page, 'expenses')).toBeGreaterThan(0);
  await expect(page.getByTestId('attention-list')).toContainText('Overdue');
});

test('adds an expense and updates the totals', async ({ page }) => {
  await openDemo(page);
  const before = await tileCents(page, 'expenses');
  await addExpense(page, uniqueName('E2E Office Supplies'), '123.45');
  await nav(page, 'Dashboard').click();
  await expect.poll(() => tileCents(page, 'expenses')).toBe(before + 12345);
});

test('keeps typed values when the expense form has an error', async ({ page }) => {
  await openDemo(page);
  await nav(page, 'Expenses').click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Vendor').fill('Kept Vendor');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Enter an amount like 1,250.00')).toBeVisible();
  await expect(dialog.getByLabel('Vendor')).toHaveValue('Kept Vendor');
});

test('creates, sends, and pays an invoice', async ({ page }) => {
  await openDemo(page);
  const client = uniqueName('E2E Client');
  await nav(page, 'Invoices').click();
  await page.getByRole('button', { name: 'New invoice' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Client').fill(client);
  await dialog.getByLabel('Description').first().fill('Design');
  await dialog.getByLabel('Quantity').first().fill('1.5');
  await dialog.getByLabel('Price').first().fill('33.33');
  await dialog.getByRole('button', { name: 'Add item' }).click();
  await dialog.getByLabel('Description').nth(1).fill('Hosting');
  await dialog.getByLabel('Price').nth(1).fill('100');
  await expect(dialog.getByTestId('invoice-preview-total')).toHaveText('$150.00');
  await dialog.getByRole('button', { name: 'Save and mark sent' }).click();

  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('invoice-total')).toHaveText('$150.00');
  await expect(page.getByText('Sent', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Mark paid' }).click();
  await expect(page.getByText('Invoice marked paid')).toBeVisible();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();

  await nav(page, 'Income').click();
  await page.getByLabel('Search').fill(client);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByTestId('transaction-table')).toContainText('$150.00');
});

test('reset restores the sample data', async ({ page }) => {
  await openDemo(page);
  const original = await tileCents(page, 'expenses');
  await addExpense(page, uniqueName('E2E Reset Check'), '500');
  await nav(page, 'Dashboard').click();
  await expect.poll(() => tileCents(page, 'expenses')).toBe(original + 50000);

  await page.getByRole('button', { name: 'Reset sample data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('Sample data restored')).toBeVisible();
  await expect.poll(() => tileCents(page, 'expenses')).toBe(original);
});

test('two browsers get separate sandboxes', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await openDemo(pageA);
  const vendor = uniqueName('E2E Private Vendor');
  await addExpense(pageA, vendor, '42');

  await openDemo(pageB);
  await pageB.goto(`/expenses?q=${encodeURIComponent(vendor)}`);
  await expect(pageB.getByText('No expenses in this date range')).toBeVisible();

  await contextA.close();
  await contextB.close();
});
