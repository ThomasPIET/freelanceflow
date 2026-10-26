'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Invoice } from '@/types';
import { invoiceService } from '@/services/invoice.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  FileDown,
  Plus,
  AlertCircle,
  Download,
  Pencil,
  Trash2,
  Mail,
  Loader2,
} from 'lucide-react';

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<number | null>(null);

  // 1. Récupération des factures
  const fetchInvoices = () => {
    setIsLoading(true);
    invoiceService
      .getAll()
      .then((res) => {
        setInvoices(res.data);
        setError(null);
      })
      .catch(() => setError('Impossible de charger les factures.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchInvoices();
    };
    loadData();
  }, []);

  // 2. Téléchargement PDF
  const downloadPdf = async (id: number) => {
    try {
      const response = await invoiceService.generatePDF(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors de la génération du PDF.');
    }
  };

  // 3. Affichage du statut avec styles conditionnels
  const STATUS_LABELS: Record<string, { label: string; style: string }> = {
    draft: {
      label: 'Brouillon',
      style: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    },
    sent: {
      label: 'Envoyée',
      style: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    paid: {
      label: 'Payée',
      style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    cancelled: {
      label: 'Annulée',
      style: 'bg-destructive/10 text-destructive border-destructive/20',
    },
  };

  // 4. Suppression d'une facture
  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return;
    try {
      await invoiceService.delete(id); // Assure-toi que cette méthode existe dans ton service
      setInvoices(invoices.filter((inv) => inv.id !== id));
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  // 5. Export CSV
  const handleExportCSV = async () => {
    try {
      const response = await invoiceService.exportCSV();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factures-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur lors de l'exportation des factures.");
    }
  };

  // 6. Envoi de la facture par email
  const handleSendEmail = async (id: number) => {
    setIsSendingEmail(id);
    const toastId = toast.loading('Envoi de la facture au client...');

    try {
      // On met à jour le statut de la facture avant d'envoyer l'email
      await invoiceService.update(id, {
        status: 'sent',
        issued_at: new Date().toISOString(),
      });


      await invoiceService.sendEmail(id);
      toast.success('La facture a été envoyée avec succès !', { id: toastId });
      // Optionnel : rafraîchir les données si le statut passe à 'sent' côté back
      fetchInvoices();
    } catch (error: unknown) {
      let message = "Erreur lors de l'envoi de l'email.";

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response: { data: { message?: string } };
        };
        message = axiosError.response?.data?.message || message;
      }

      toast.error(message, { id: toastId });
    } finally {
      setIsSendingEmail(null);
    }
  };

  if (error) {
    return (
      <div className="text-destructive flex h-[50vh] flex-col items-center justify-center gap-2">
        <AlertCircle size={40} />
        <p>{error}</p>
        <Button onClick={fetchInvoices} variant="outline" className="mt-2">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="gap-4n flex flex-col items-center justify-between max-[450px]:items-start min-[450px]:flex-row">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold">
            Factures
          </h1>
          <p className="text-muted-foreground">
            Suivez vos paiements et gérez vos PDF.
          </p>
        </div>
        <div className="flex gap-3 max-[500px]:flex-col max-[450px]:items-start">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="border-primary/20 hover:bg-primary/5 text-primary gap-2"
          >
            <Download size={18} /> Exporter CSV
          </Button>
          <Button
            className="gap-2 shadow-sm"
            onClick={() => router.push('/invoices/new')}
          >
            <Plus size={18} /> Nouvelle Facture
          </Button>
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="text-foreground/70 text-sm font-medium">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              `Total : ${invoices.length} factures`
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="pl-6 text-xs font-bold tracking-wider uppercase">
                  Référence
                </TableHead>
                <TableHead className="text-xs font-bold tracking-wider uppercase">
                  Client
                </TableHead>
                <TableHead className="text-center text-xs font-bold tracking-wider uppercase">
                  Statut
                </TableHead>
                <TableHead className="text-xs font-bold tracking-wider uppercase">
                  Montant TTC
                </TableHead>
                <TableHead className="pr-6 text-right text-xs font-bold tracking-wider uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-7 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Skeleton className="ml-auto h-8 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-32 text-center italic"
                  >
                    Aucune facture trouvée.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="group hover:bg-muted/5 transition-colors"
                  >
                    <TableCell className="text-primary pl-6 font-mono text-xs font-bold">
                      #INV-{inv.id.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {inv.Client?.name || 'Inconnu'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`${STATUS_LABELS[inv.status]?.style || STATUS_LABELS.draft.style} px-3 py-1`}
                      >
                        {STATUS_LABELS[inv.status]?.label || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {parseFloat(inv.total_ttc).toFixed(2)} €
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2 border-blue-500/20 text-blue-600 transition-all hover:border-blue-500 hover:bg-blue-500/5"
                          onClick={() => handleSendEmail(inv.id)}
                          disabled={isSendingEmail === inv.id}
                        >
                          {isSendingEmail === inv.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Mail size={14} />
                          )}
                          Mail
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary h-8 w-8"
                          onClick={() =>
                            router.push(`/invoices/${inv.id}/edit`)
                          } // Redirection edit
                        >
                          <Pencil size={14} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={() => handleDelete(inv.id)}
                        >
                          <Trash2 size={14} />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary/20 hover:border-primary hover:bg-primary/5 text-primary h-8 gap-2 transition-all"
                          onClick={() => downloadPdf(inv.id)}
                        >
                          <FileDown size={14} />
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
