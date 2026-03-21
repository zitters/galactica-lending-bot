import { Metadata } from 'next';
import LoanHistoryProfile from '@/ui/LoanHistoryProfile';

export const metadata: Metadata = {
  title: 'Loan History | Galactica Lending Bot',
  description: 'View your loan history and repayment status',
};

interface LoanHistoryPageProps {
  searchParams: Promise<{ address?: string }>;
}

export default async function LoanHistoryPage({ searchParams }: LoanHistoryPageProps) {
  const params = await searchParams;
  const btcAddress = params.address || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

  return (
    <div className="min-h-screen bg-cyber-void">
      <LoanHistoryProfile btcAddress={btcAddress} />
    </div>
  );
}
