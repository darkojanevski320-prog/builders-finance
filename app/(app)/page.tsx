import { requireSandbox } from '@/lib/data/sandbox';

export default async function DashboardPage() {
  const sandbox = await requireSandbox();
  return <h1 className="text-2xl font-semibold">{sandbox.businessName}</h1>;
}
