'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { invoiceService } from '@/services/invoice.service';
import { clientService } from '@/services/client.service';
import { serviceService } from '@/services/service.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { Service, Client, Invoice, InvoiceStatus } from '@/types';

// On définit une interface pour le formulaire pour éviter le "any"
interface PrestationForm {
  service_id: string;
  quantity: string;
  unit_price: string;
  id?: number; // Pour garder l'ID de la ligne existante si besoin
}

export default function EditInvoicePage() {
  const router = useRouter();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);

  const [invoiceData, setInvoiceData] = useState({
    client_id: '',
    status: 'draft' as InvoiceStatus,
    prestations: [] as PrestationForm[],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, cliRes, servRes] = await Promise.all([
          invoiceService.getOne(Number(id)),
          clientService.getAll(),
          serviceService.getAll(),
        ]);

        setClients(cliRes.data);
        setAvailableServices(servRes.data);

        const invoice = invRes.data;

        setInvoiceData({
          client_id: invoice.client_id.toString(),
          status: invoice.status,
          prestations: (invoice.InvoiceLines || []).map((line) => ({
            id: line.id,
            service_id: line.service_id.toString(),
            quantity: line.quantity.toString(),
            unit_price: line.unit_price.toString(),
          })),
        });
      } catch {
        toast.error('Erreur lors de la récupération des données');
        router.push('/invoices');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  const totals = useMemo(() => {
    const ht = invoiceData.prestations.reduce((acc, p) => {
      const q = Number(p.quantity) || 0;
      const up = Number(p.unit_price) || 0;
      return acc + q * up;
    }, 0);
    const tva = ht * 0.2;
    return {
      ht: ht.toFixed(2),
      tva: tva.toFixed(2),
      ttc: (ht + tva).toFixed(2),
    };
  }, [invoiceData.prestations]);

  const addPrestation = () => {
    setInvoiceData({
      ...invoiceData,
      prestations: [
        ...invoiceData.prestations,
        { service_id: '', quantity: '1', unit_price: '0' },
      ],
    });
  };

  const removePrestation = (index: number) => {
    const newPrestations = invoiceData.prestations.filter(
      (_, i) => i !== index
    );
    setInvoiceData({ ...invoiceData, prestations: newPrestations });
  };

  const updatePrestation = (
    index: number,
    field: keyof PrestationForm,
    value: string
  ) => {
    const newPrestations = [...invoiceData.prestations];

    if (field === 'service_id') {
      const selectedService = availableServices.find(
        (s) => s.id.toString() === value
      );
      newPrestations[index] = {
        ...newPrestations[index],
        service_id: value,
        unit_price: selectedService ? selectedService.hourly_rate : '0',
      };
    } else {
      newPrestations[index] = { ...newPrestations[index], [field]: value };
    }

    setInvoiceData({ ...invoiceData, prestations: newPrestations });
  };

  const handleUpdate = async () => {
    try {
      const payload: Partial<Invoice> = {
        client_id: Number(invoiceData.client_id),
        status: invoiceData.status,
        total_ht: totals.ht,
        tva_rate: '20',
        total_ttc: totals.ttc,
        lines: invoiceData.prestations.map((p) => ({
          service_id: Number(p.service_id),
          quantity: p.quantity,
          unit_price: p.unit_price,
          total: (Number(p.quantity) * Number(p.unit_price)).toFixed(2),
        })),
      };

      // Si le statut est passé à 'sent', on ajoute la date d'émission
      if (invoiceData.status === 'sent') {
        payload.issued_at = new Date().toISOString();
      }

      await invoiceService.update(Number(id), payload);

      toast.success('Facture mise à jour avec succès');
      router.push('/invoices');
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-3xl font-bold">Modifier la facture #INV-{id}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="bg-muted/20 flex flex-row items-center justify-between border-b py-4">
              <CardTitle className="text-lg font-semibold">
                Lignes de prestation
              </CardTitle>
              <Button
                onClick={addPrestation}
                size="sm"
                variant="outline"
                className="border-primary/20 text-primary hover:bg-primary/5 gap-2"
              >
                <Plus size={14} /> Ajouter un service
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-border/40 divide-y">
                {invoiceData.prestations.map((p, index) => (
                  <div
                    key={index}
                    className="hover:bg-muted/5 flex items-end gap-3 p-4 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Service
                      </Label>
                      <Select
                        value={p.service_id}
                        // On ajoute "|| ''" pour transformer le null potentiel en string vide
                        onValueChange={(val) =>
                          updatePrestation(index, 'service_id', val || '')
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue>
                            {availableServices.find(
                              (s) => s.id.toString() === p.service_id
                            )?.label || 'Choisir un service'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableServices.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-2">
                      <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Heures
                      </Label>
                      <Input
                        type="number"
                        value={p.quantity}
                        onChange={(e) =>
                          updatePrestation(index, 'quantity', e.target.value)
                        }
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Prix Unit.
                      </Label>
                      <Input
                        type="number"
                        value={p.unit_price}
                        readOnly
                        className="bg-muted cursor-not-allowed"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removePrestation(index)}
                      disabled={invoiceData.prestations.length === 1}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/20 border-b py-4">
              <CardTitle className="text-lg font-semibold">
                Récapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Client</Label>
                <Select
                  value={invoiceData.client_id}
                  onValueChange={(val) =>
                    setInvoiceData({ ...invoiceData, client_id: val || '' })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue>
                      {clients.find(
                        (c) => c.id.toString() === invoiceData.client_id
                      )?.name || 'Sélectionner un client'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Statut</Label>
                <Select
                  value={invoiceData.status}
                  onValueChange={(val) => {
                    if (val) {
                      setInvoiceData({
                        ...invoiceData,
                        status: val as InvoiceStatus,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="sent">Envoyée</SelectItem>
                    <SelectItem value="paid">Payée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-border/60 border-t pt-4">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span className="text-muted-foreground text-sm uppercase">
                    Total TTC
                  </span>
                  <span className="text-primary">{totals.ttc} €</span>
                </div>
              </div>

              <Button className="w-full gap-2" size="lg" onClick={handleUpdate}>
                <Save size={18} /> Enregistrer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
