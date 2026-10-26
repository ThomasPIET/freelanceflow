import { useInvoiceWizard } from '@/hooks/use-invoice-wizard';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { clientService } from '@/services/client.service';
import { Client } from '@/types';

export function ClientStep() {
  const { selectedClientId, setSelectedClientId } = useInvoiceWizard();
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    clientService.getAll().then((res) => setClients(res.data));
  }, []);

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="client">Sélectionner le destinataire</Label>
        <select
          id="client"
          value={selectedClientId || ''}
          onChange={(e) => setSelectedClientId(Number(e.target.value))}
          className="border-input focus:ring-ring flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none"
        >
          <option value="">Choisir un client...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.company ? `(${c.company})` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
