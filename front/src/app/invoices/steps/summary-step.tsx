import { useInvoiceWizard } from '@/hooks/use-invoice-wizard';
import { Separator } from '@/components/ui/separator';

export function SummaryStep() {
  const { lines, totals, selectedClientId } = useInvoiceWizard();

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="mb-2 font-medium">Récapitulatif de la facture</h3>
        <p className="text-muted-foreground text-sm">
          ID Client : {selectedClientId}
        </p>
        <p className="text-muted-foreground text-sm">
          Nombre de lignes : {lines.length}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Total HT</span>
          <span>{totals.ht} €</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>TVA (20%)</span>
          <span>{totals.tva} €</span>
        </div>
        <Separator />
        <div className="flex justify-between text-lg font-bold">
          <span>Total TTC</span>
          <span className="text-primary">{totals.ttc} €</span>
        </div>
      </div>
    </div>
  );
}
