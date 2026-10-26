'use client';

import { useState, useEffect, useMemo } from 'react';
import { Invoice, Client, Service } from '@/types';
import { invoiceService } from '@/services/invoice.service';
import { clientService } from '@/services/client.service';
import { serviceService } from '@/services/service.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Users,
  Briefcase,
  FileText,
  ArrowRight,
  TrendingUp,
  Wallet,
  Clock,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      invoiceService.getAll(),
      clientService.getAll(),
      serviceService.getAll(),
    ])
      .then(([invoicesRes, clientsRes, servicesRes]) => {
        setInvoices(invoicesRes.data);
        setClients(clientsRes.data);
        setServices(servicesRes.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Erreur dashboard:', err);
        setError('Impossible de charger les données.');
        setIsLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    const pendingInvoices = invoices.filter((inv) => inv.status === 'sent');

    const caTotal = paidInvoices.reduce(
      (acc, inv) => acc + parseFloat(inv.total_ht || '0'),
      0
    );
    const totalPending = pendingInvoices.reduce(
      (acc, inv) => acc + parseFloat(inv.total_ttc || '0'),
      0
    );

    return {
      caTotal: caTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 }),
      totalPending: totalPending.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
      }),
      countPending: pendingInvoices.length,
      totalInvoices: invoices.length,
      totalClients: clients.length,
      totalServices: services.length,
      recent: invoices.slice(0, 5),
    };
  }, [invoices, clients, services]);

  if (error) {
    return (
      <div className="text-destructive flex h-[50vh] flex-col items-center justify-center gap-2">
        <AlertCircle size={40} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-foreground text-3xl font-bold">
          Tableau de bord
        </h1>
        <p className="text-muted-foreground">
          Voici ce qui se passe dans votre activité.
        </p>
      </div>

      {/* KPIs Dynamiques */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Chiffre d'Affaires HT"
          value={`${stats.caTotal} €`}
          icon={<TrendingUp size={24} />}
          isLoading={isLoading}
          colorClass="bg-primary/10 text-primary"
        />
        <KpiCard
          title="Encours (TTC)"
          value={`${stats.totalPending} €`}
          icon={<Wallet size={24} />}
          isLoading={isLoading}
          colorClass="bg-amber-500/10 text-amber-600"
          valueClass="text-amber-600"
        />
        <KpiCard
          title="Factures en attente"
          value={stats.countPending.toString()}
          icon={<Clock size={24} />}
          isLoading={isLoading}
          colorClass="bg-blue-500/10 text-blue-600"
          valueClass="text-blue-600"
        />
        <KpiCard
          title="Total Factures"
          value={stats.totalInvoices.toString()}
          icon={<FileText size={24} />}
          isLoading={isLoading}
          colorClass="bg-violet-500/10 text-violet-600"
          valueClass="text-violet-600"
        />
        <KpiCard
          title="Clients"
          value={stats.totalClients.toString()}
          icon={<Users size={24} />}
          isLoading={isLoading}
          colorClass="bg-emerald-500/10 text-emerald-600"
          valueClass="text-emerald-600"
        />
        <KpiCard
          title="Prestations"
          value={stats.totalServices.toString()}
          icon={<Briefcase size={24} />}
          isLoading={isLoading}
          colorClass="bg-rose-500/10 text-rose-600"
          valueClass="text-rose-600"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Navigation Rapide */}
        <div className="space-y-4 lg:col-span-1">
          <h2 className="px-1 text-lg font-semibold">Accès rapide</h2>
          <div className="grid gap-3">
            <QuickLink
              href="/invoices"
              icon={<FileText size={18} />}
              title="Factures"
              color="bg-primary"
            />
            <QuickLink
              href="/clients"
              icon={<Users size={18} />}
              title="Clients"
              color="bg-primary"
            />
            <QuickLink
              href="/prestations"
              icon={<Briefcase size={18} />}
              title="Prestations"
              color="bg-primary"
            />
          </div>
        </div>

        {/* Dernières Factures */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Dernières factures</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-5 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : stats.recent.length > 0 ? (
                  stats.recent.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-bold">
                        #INV-{inv.id.toString().padStart(3, '0')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {inv.Client?.name || 'Client inconnu'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === 'paid' ? 'default' : 'secondary'
                          }
                          className="capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {inv.total_ttc} €
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground py-8 text-center italic"
                    >
                      Aucune facture pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Composant interne pour les KPIs avec Skeleton intégré
function KpiCard({
  title,
  value,
  icon,
  isLoading,
  colorClass,
  valueClass = '',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  isLoading: boolean;
  colorClass: string;
  valueClass?: string;
}) {
  return (
    <Card
      className={cn(
        'border-border/50 shadow-sm',
        'aspect-square md:aspect-auto'
      )}
    >
      <CardContent className="flex h-full flex-col items-center justify-center md:flex-row md:justify-start md:gap-4">
        <div
          className={cn(
            'mb-3 hidden rounded-xl p-4 min-[350px]:block',
            'md:mb-0 md:p-3'
          )}
        >
          <div className={colorClass}>{icon}</div>
        </div>
        <div className="text-center md:text-left">
          <p className="text-muted-foreground text-sm font-medium">{title}</p>
          {isLoading ? (
            <Skeleton className="mx-auto mt-1 h-8 w-24 md:mx-0" />
          ) : (
            <h3
              className={cn(
                'font-bold min-[450px]:text-xl lg:text-2xl',
                valueClass
              )}
            >
              {value}
            </h3>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  title,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-card hover:bg-muted/50 group flex items-center justify-between rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 text-white ${color}`}>{icon}</div>
        <span className="font-medium">{title}</span>
      </div>
      <ArrowRight
        size={16}
        className="text-muted-foreground transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
