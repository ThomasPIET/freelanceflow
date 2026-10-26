import { useState, useMemo, createContext, useContext } from 'react';
import { Service, InvoiceLine } from '@/types';
import { invoiceService } from '@/services/invoice.service';
import { useRouter } from 'next/navigation';

interface InvoiceWizardState {
  step: number;
  nextStep: () => void;
  prevStep: () => void;
  selectedClientId: number | null;
  setSelectedClientId: (id: number | null) => void;
  lines: Partial<InvoiceLine>[];
  addLine: (service?: Service) => void;
  updateLine: (
    index: number,
    field: keyof InvoiceLine,
    value: string | number
  ) => void;
  removeLine: (index: number) => void;
  totals: { ht: number; tva: number; ttc: number };
  isSubmitting: boolean;
  saveInvoice: () => Promise<void>;
  saveAndSendInvoice: () => Promise<void>;
}

const InvoiceWizardContext = createContext<InvoiceWizardState | null>(null);

export function useInvoiceWizardProvider() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [lines, setLines] = useState<Partial<InvoiceLine>[]>([]);

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 3));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  const addLine = (service?: Service) => {
    const newLine: Partial<InvoiceLine> = {
      service_id: service?.id || 0,
      quantity: '1',
      unit_price: service?.hourly_rate || '0',
      total: service?.hourly_rate || '0',
    };
    setLines([...lines, newLine]);
  };

  const updateLine = (
    index: number,
    field: keyof InvoiceLine,
    value: string | number
  ) => {
    setLines((prev) => {
      const newLines = [...prev];
      newLines[index] = { ...newLines[index], [field]: value };

      if (field === 'quantity' || field === 'unit_price') {
        const qte = parseFloat(newLines[index].quantity?.toString() || '0');
        const price = parseFloat(newLines[index].unit_price?.toString() || '0');
        newLines[index].total = (qte * price).toFixed(2);
      }
      return newLines;
    });
  };

  const totals = useMemo(() => {
    const ht = lines.reduce(
      (acc, line) => acc + parseFloat(line.total || '0'),
      0
    );
    const tva = ht * 0.2;
    return { ht, tva, ttc: ht + tva };
  }, [lines]);

  const saveInvoice = async () => {
    setIsSubmitting(true);

    try {
      await invoiceService.create({
        client_id: selectedClientId!,
        status: 'draft',
        total_ht: totals.ht.toFixed(2),
        tva_rate: '20',
        total_ttc: totals.ttc.toFixed(2),
        lines: lines as InvoiceLine[],
      });
      router.push('/invoices');
    } catch (err) {
      console.error('Erreur lors de la création de la facture:', err);
      setIsSubmitting(false);
    }
  };

  const saveAndSendInvoice = async () => {
    setIsSubmitting(true);
    try {
      // Étape A : Créer la facture
      const res = await invoiceService.create({
        client_id: selectedClientId!,
        status: 'sent',
        total_ht: totals.ht.toFixed(2),
        tva_rate: '20',
        total_ttc: totals.ttc.toFixed(2),
        issued_at: new Date().toISOString(),
        lines: lines as InvoiceLine[],
      });

      const newInvoiceId = res.data.id;

      // Étape B : Envoyer l'email
      await invoiceService.sendEmail(newInvoiceId);

      router.push('/invoices');
    } catch (err) {
      console.error('Erreur lors de la création et l’envoi:', err);
      setIsSubmitting(false);
    }
  };

  return {
    step,
    nextStep,
    prevStep,
    selectedClientId,
    setSelectedClientId,
    lines,
    addLine,
    updateLine,
    removeLine: (index: number) =>
      setLines(lines.filter((_, i) => i !== index)),
    totals,
    isSubmitting,
    saveInvoice,
    saveAndSendInvoice,
  };
}

export { InvoiceWizardContext };

export function useInvoiceWizard() {
  const context = useContext(InvoiceWizardContext);
  if (!context) {
    throw new Error(
      'useInvoiceWizard must be used within an InvoiceWizardProvider'
    );
  }
  return context;
}
