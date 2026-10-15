import { expect, type Page } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export function nav(page: Page, name: 'Dashboard' | 'Income' | 'Expenses' | 'Invoices') {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
}

/** Opens a fresh sandbox in this browser context and waits for the dashboard. */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole('button', { name: 'Open your demo copy' }).click();
  await expect(page.getByTestId('tile-income')).toBeVisible({ timeout: 30_000 });
}

export async function tileCents(page: Page, id: 'income' | 'expenses' | 'net' | 'owed'): Promise<number> {
  return Number(await page.getByTestId(`tile-${id}`).getAttribute('data-cents'));
}

export async function addExpense(page: Page, vendor: string, amount: string): Promise<void> {
  await nav(page, 'Expenses').click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Vendor').fill(vendor);
  await dialog.getByLabel('Category').selectOption({ label: 'Equipment' });
  await dialog.getByLabel('Amount').fill(amount);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Expense added')).toBeVisible();
  await expect(page.getByTestId('transaction-table')).toContainText(vendor);
}
