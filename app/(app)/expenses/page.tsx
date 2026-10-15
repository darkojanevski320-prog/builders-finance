import { TransactionsScreen } from '@/components/transactions/transactions-screen';

export default function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TransactionsScreen kind="expense" searchParams={searchParams} />;
}
