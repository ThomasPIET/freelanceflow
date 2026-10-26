'use client';

import {
  useInvoiceWizardProvider,
  InvoiceWizardContext,
  useInvoiceWizard,
} from '@/hooks/use-invoice-wizard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Save, Loader2, Mail } from 'lucide-react';

// Import des sous-composants
import { ClientStep } from '@/app/invoices/steps/client-step';
import { ItemsStep } from '@/app/invoices/steps/items-step';
import { SummaryStep } from '@/app/invoices/steps/summary-step';

export function InvoiceWizard() {
  const wizard = useInvoiceWizardProvider();

  return (
    <InvoiceWizardContext.Provider value={wizard}>
      <InvoiceWizardContent />
    </InvoiceWizardContext.Provider>
  );
}

function InvoiceWizardContent() {
  const {
    step,
    nextStep,
    prevStep,
    saveInvoice,
    saveAndSendInvoice,
    isSubmitting,
  } = useInvoiceWizard();

  return (
    <Card className="border-border mx-auto w-full max-w-4xl shadow-lg">
      <CardHeader className="bg-muted/10 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading text-xl">
              Nouvelle Facture
            </CardTitle>
            <p className="text-muted-foreground text-sm">Étape {step} sur 3</p>
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            Mode Brouillon
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="min-h-[400px] pt-8">
        {step === 1 && <ClientStep />}
        {step === 2 && <ItemsStep />}
        {step === 3 && <SummaryStep />}
      </CardContent>

      <CardFooter className="bg-muted/5 flex justify-between border-t py-6">
        <Button
          variant="ghost"
          onClick={prevStep}
          disabled={step === 1 || isSubmitting}
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
        </Button>

        <div className="flex gap-3">
          {step < 3 ? (
            <Button onClick={nextStep}>
              Suivant <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={saveInvoice}
                disabled={isSubmitting}
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              >
                {isSubmitting ? '...' : 'Brouillon'}
                <Save className="ml-2 h-4 w-4" />
              </Button>

              <Button
                onClick={saveAndSendInvoice}
                disabled={isSubmitting}
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Enregistrer et envoyer
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
