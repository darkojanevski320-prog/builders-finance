import { addDays, addMonths, daysInMonth, diffDays, endOfMonth, monthsBetween, startOfMonth } from '@/lib/finance/dates';
import { invoiceTotalCents } from '@/lib/finance/money';
import {
  CATEGORIES, CLIENTS, CONTRACTORS, EQUIPMENT_NOTES, MARKETING, SERVICES, SOFTWARE, TRAVEL, WORKSHOP_PAYERS,
} from './catalog';
import { chance, createRandom, pick, randInt, type Random } from './random';
import type { SampleBusiness, SampleInvoice, SampleInvoiceItem, SampleTransaction } from './types';

export const SAMPLE_SEED = 20261015;
export const SAMPLE_BUSINESS_NAME = 'Northfield Studio';
export const HISTORY_MONTHS = 18;
export const CLIENT_PAYMENTS_CATEGORY = 'Client payments';

// Payroll is sized from the generated income so the margin lands near 22% before the
// January loss month, and between 15% and 25% after it, for any "today".
const TARGET_MARGIN_BEFORE_LOSS_MONTH = 0.22;

export function generateSampleBusiness({ today, seed = SAMPLE_SEED }: { today: string; seed?: number }): SampleBusiness {
  const rng = createRandom(seed);
  const firstDay = startOfMonth(addMonths(today, -(HISTORY_MONTHS - 1)));
  const months = monthsBetween(firstDay, today);

  const invoices = generateInvoices(rng, months, today);
  finalizeInvoiceStates(rng, invoices, today);
  invoices.sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.key.localeCompare(b.key));
  invoices.forEach((invoice, index) => {
    invoice.number = `INV-${1001 + index}`;
  });

  const income = [...paymentTransactions(invoices), ...otherIncome(rng, months, today)];
  const otherExpenses = expenses(rng, months, firstDay, today);
  const runs = payrollDates(firstDay, today);
  const perRunCents = calibratePayroll(income, otherExpenses, runs.length);
  const transactions: SampleTransaction[] = [
    ...income,
    ...otherExpenses,
    ...runs.map((date) => ({
      kind: 'expense' as const, date, amountCents: perRunCents, categoryKey: 'payroll',
      counterparty: 'Northfield Studio payroll', note: 'Team payroll, 6 people', invoiceKey: null,
    })),
  ];
  addLossMonth(rng, transactions, firstDay, today);
  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.counterparty.localeCompare(b.counterparty));

  return { name: SAMPLE_BUSINESS_NAME, categories: CATEGORIES, clients: CLIENTS, invoices, transactions };
}

function generateInvoices(rng: Random, months: string[], today: string): SampleInvoice[] {
  const invoices: SampleInvoice[] = [];
  months.forEach((month, index) => {
    const first = `${month}-01`;
    const isCurrentMonth = month === today.slice(0, 7);
    const lastDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth(first);
    const monthNumber = Number(month.slice(5, 7));
    let count = randInt(rng, 10, 14);
    if (monthNumber === 1 || monthNumber === 8) count -= 3; // seasonal dips
    if (isCurrentMonth) count = Math.max(1, Math.round((count * lastDay) / daysInMonth(first)));
    const growth = 0.92 + 0.01 * index;

    for (let i = 0; i < count; i += 1) {
      const issueDate = addDays(first, randInt(rng, 0, lastDay - 1));
      const termsDays = chance(rng, 0.5) ? 15 : 30;
      const invoice: SampleInvoice = {
        key: `inv-${invoices.length + 1}`,
        number: '',
        clientKey: pick(rng, CLIENTS).key,
        issueDate,
        dueDate: addDays(issueDate, termsDays),
        status: 'sent',
        paidDate: null,
        notes: null,
        items: splitIntoItems(rng, invoiceAmountCents(rng, growth)),
      };
      assignPayment(rng, invoice, termsDays, today);
      invoices.push(invoice);
    }
  });
  return invoices;
}

function invoiceAmountCents(rng: Random, growth: number): number {
  const dollars = chance(rng, 0.1) ? randInt(rng, 6000, 12000) : randInt(rng, 1200, 4200);
  const roundedTo50 = Math.round((dollars * growth) / 50) * 50;
  return Math.min(1_200_000, Math.max(80_000, roundedTo50 * 100));
}

function splitIntoItems(rng: Random, totalCents: number): SampleInvoiceItem[] {
  const count = totalCents >= 300_000 ? randInt(rng, 1, 3) : 1;
  const services = [...SERVICES];
  const items: SampleInvoiceItem[] = [];
  let remaining = totalCents;
  for (let i = 0; i < count; i += 1) {
    const description = services.splice(Math.floor(rng() * services.length), 1)[0];
    const isLast = i === count - 1;
    const share = randInt(rng, 25, 50) / 100;
    const amount = isLast ? remaining : Math.max(10_000, Math.round((remaining * share) / 5_000) * 5_000);
    remaining -= isLast ? 0 : amount;
    items.push({ description, quantity: 1, unitPriceCents: amount });
  }
  return items;
}

function assignPayment(rng: Random, invoice: SampleInvoice, termsDays: number, today: string): void {
  const roll = rng();
  let paidDate: string | null;
  if (roll < 0.7) paidDate = addDays(invoice.issueDate, randInt(rng, 3, termsDays));
  else if (roll < 0.92) paidDate = addDays(invoice.dueDate, randInt(rng, 5, 40));
  else paidDate = diffDays(today, invoice.dueDate) > 60 ? addDays(invoice.dueDate, randInt(rng, 41, 60)) : null;
  if (paidDate && paidDate <= today) {
    invoice.status = 'paid';
    invoice.paidDate = paidDate;
  }
}

function markPaid(invoice: SampleInvoice, paidDate: string): void {
  invoice.status = 'paid';
  invoice.paidDate = paidDate;
}

function markOpen(invoice: SampleInvoice, status: 'sent' | 'draft'): void {
  invoice.status = status;
  invoice.paidDate = null;
}

/** Forces the "today" picture the spec promises: 2 drafts, 4 to 6 overdue, at least 3 due soon. */
function finalizeInvoiceStates(rng: Random, invoices: SampleInvoice[], today: string): void {
  const newestFirst = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.key.localeCompare(a.key));
  for (const invoice of newestFirst.slice(0, 2)) markOpen(invoice, 'draft');

  const target = randInt(rng, 4, 6);
  const overdue = invoices
    .filter((i) => i.status === 'sent' && i.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const invoice of overdue.slice(0, Math.max(0, overdue.length - target))) {
    const paid = addDays(invoice.dueDate, randInt(rng, 3, 20));
    markPaid(invoice, paid < today ? paid : today);
  }
  if (overdue.length < target) {
    const recentlyPaid = invoices
      .filter((i) => i.status === 'paid' && i.dueDate < today)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    for (const invoice of recentlyPaid.slice(0, target - overdue.length)) markOpen(invoice, 'sent');
  }

  const isDueSoon = (i: SampleInvoice) => i.dueDate >= today && diffDays(i.dueDate, today) <= 14;
  const dueSoon = invoices.filter((i) => i.status === 'sent' && isDueSoon(i));
  if (dueSoon.length < 3) {
    const paidEarly = invoices
      .filter((i) => i.status === 'paid' && isDueSoon(i))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const invoice of paidEarly.slice(0, 3 - dueSoon.length)) markOpen(invoice, 'sent');
  }
}

function paymentTransactions(invoices: SampleInvoice[]): SampleTransaction[] {
  const clientNames = new Map(CLIENTS.map((c) => [c.key, c.name]));
  return invoices
    .filter((i) => i.status === 'paid' && i.paidDate)
    .map((i) => ({
      kind: 'income' as const,
      date: i.paidDate as string,
      amountCents: invoiceTotalCents(i.items),
      categoryKey: 'client-payments',
      counterparty: clientNames.get(i.clientKey) ?? 'Client',
      note: `Payment for ${i.number}`,
      invoiceKey: i.key,
    }));
}

function randomDayIn(rng: Random, first: string): string {
  return addDays(first, randInt(rng, 0, daysInMonth(first) - 1));
}

function otherIncome(rng: Random, months: string[], today: string): SampleTransaction[] {
  const rows: SampleTransaction[] = [];
  for (const month of months) {
    const first = `${month}-01`;
    if (chance(rng, 0.35)) {
      const date = randomDayIn(rng, first);
      const amountCents = randInt(rng, 400, 1500) * 100;
      if (date <= today) {
        rows.push({ kind: 'income', date, amountCents, categoryKey: 'workshops', counterparty: pick(rng, WORKSHOP_PAYERS), note: 'Workshop fee', invoiceKey: null });
      }
    }
    const interestDate = endOfMonth(first);
    const interestCents = randInt(rng, 800, 4000);
    if (interestDate <= today) {
      rows.push({ kind: 'income', date: interestDate, amountCents: interestCents, categoryKey: 'interest', counterparty: 'Summit Bank', note: 'Monthly interest', invoiceKey: null });
    }
  }
  return rows;
}

function expenses(rng: Random, months: string[], firstDay: string, today: string): SampleTransaction[] {
  const rows: SampleTransaction[] = [];
  const add = (date: string, categoryKey: string, counterparty: string, amountCents: number, note: string | null) => {
    if (date >= firstDay && date <= today) {
      rows.push({ kind: 'expense', date, amountCents, categoryKey, counterparty, note, invoiceKey: null });
    }
  };

  for (const month of months) {
    const first = `${month}-01`;
    const monthNumber = Number(month.slice(5, 7));
    add(first, 'rent', 'Harborview Properties', 320_000, 'Studio rent');
    for (const sub of SOFTWARE) add(addDays(first, sub.day - 1), 'software', sub.vendor, sub.cents, sub.note);
    if ([1, 4, 7, 10].includes(monthNumber)) add(addDays(first, 4), 'insurance', 'Brightline Insurance', 195_000, 'Quarterly business insurance');

    const peakSeason = [12, 1, 2, 6, 7, 8].includes(monthNumber);
    add(addDays(first, 17), 'utilities', 'Metro Power', 18_000 + (peakSeason ? randInt(rng, 12_000, 24_000) : randInt(rng, 0, 6_000)), 'Electricity');
    add(addDays(first, 21), 'utilities', 'Fiberlink Internet', 12_000, 'Internet');

    const contractorCount = randInt(rng, 2, 4);
    for (let i = 0; i < contractorCount; i += 1) {
      add(randomDayIn(rng, first), 'contractors', pick(rng, CONTRACTORS), randInt(rng, 8, 30) * 5_000, 'Project work');
    }
    const marketingCount = randInt(rng, 1, 2);
    for (let i = 0; i < marketingCount; i += 1) {
      const m = pick(rng, MARKETING);
      add(randomDayIn(rng, first), 'marketing', m.vendor, randInt(rng, 300, 1500) * 100, m.note);
    }
    const travelCount = randInt(rng, 0, 3);
    for (let i = 0; i < travelCount; i += 1) {
      const t = pick(rng, TRAVEL);
      add(randomDayIn(rng, first), 'travel-fees', t.vendor, randInt(rng, 80, 600) * 100, t.note);
    }
    add(addDays(first, 27), 'travel-fees', 'Summit Bank', 2_500, 'Monthly account fee');
    if (chance(rng, 0.25)) {
      add(randomDayIn(rng, first), 'equipment', 'Gearloft', randInt(rng, 1500, 4000) * 100, pick(rng, EQUIPMENT_NOTES));
    }
  }
  return rows;
}

/** Every second Friday-ish payday, starting on the 5th day of the history. */
function payrollDates(firstDay: string, today: string): string[] {
  const dates: string[] = [];
  for (let date = addDays(firstDay, 4); date <= today; date = addDays(date, 14)) dates.push(date);
  return dates;
}

function calibratePayroll(income: SampleTransaction[], otherExpenses: SampleTransaction[], runs: number): number {
  const incomeCents = income.reduce((sum, t) => sum + t.amountCents, 0);
  const expenseCents = otherExpenses.reduce((sum, t) => sum + t.amountCents, 0);
  const perRun = ((1 - TARGET_MARGIN_BEFORE_LOSS_MONTH) * incomeCents - expenseCents) / Math.max(1, runs);
  return Math.min(1_400_000, Math.max(600_000, Math.round(perRun / 1_000) * 1_000));
}

/** Adds an equipment upgrade in the latest complete January, sized so that month is a loss. */
function addLossMonth(rng: Random, transactions: SampleTransaction[], firstDay: string, today: string): void {
  const currentMonth = startOfMonth(today);
  let january = `${today.slice(0, 4)}-01-01`;
  if (january >= currentMonth) january = `${Number(today.slice(0, 4)) - 1}-01-01`;
  if (january < firstDay) return;
  const end = endOfMonth(january);
  let net = 0;
  for (const t of transactions) {
    if (t.date < january || t.date > end) continue;
    net += t.kind === 'income' ? t.amountCents : -t.amountCents;
  }
  const amountCents = Math.max(900_000, Math.ceil((net + randInt(rng, 50_000, 150_000)) / 100_000) * 100_000);
  transactions.push({
    kind: 'expense', date: addDays(january, 19), amountCents, categoryKey: 'equipment',
    counterparty: 'Gearloft', note: 'Studio equipment upgrade', invoiceKey: null,
  });
}
