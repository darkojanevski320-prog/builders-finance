import { TransactionsScreen } from '@/components/transactions/transactions-screen';

export default function IncomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TransactionsScreen kind="income" searchParams={searchParams} />;
}
