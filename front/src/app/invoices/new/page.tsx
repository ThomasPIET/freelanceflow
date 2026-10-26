'use client';

import { InvoiceWizard } from '@/components/invoices/invoice-wizard';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewInvoicePage() {
  return (
    <div className="container space-y-8 py-10">
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon">
            <ChevronLeft />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Créer une facture</h1>
      </div>

      <InvoiceWizard />
    </div>
  );
}
