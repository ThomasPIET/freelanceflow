'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/types';
import { serviceService } from '@/services/service.service';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  Euro,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States pour les Modales & Loading d'action
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // 1. Chargement des données réelles
  const fetchServices = () => {
    setIsLoading(true);
    serviceService
      .getAll()
      .then((res) => {
        setServices(res.data);
        setError(null);
      })
      .catch(() =>
        setError('Impossible de charger le catalogue de prestations.')
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // 2. Handlers API (Create, Update, Delete)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      label: formData.get('label') as string,
      hourly_rate: formData.get('hourly_rate') as string,
    };

    try {
      if (selectedService) {
        await serviceService.update(selectedService.id, payload);
      } else {
        await serviceService.create(payload);
      }
      setIsFormOpen(false);
      fetchServices();
    } catch {
      alert("Erreur lors de l'enregistrement de la prestation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedService) return;
    setIsSubmitting(true);
    try {
      await serviceService.delete(selectedService.id);
      setIsDeleteOpen(false);
      fetchServices();
    } catch {
      alert('Erreur lors de la suppression.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedService(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setSelectedService(service);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (service: Service) => {
    setSelectedService(service);
    setIsDeleteOpen(true);
  };

  if (error) {
    return (
      <div className="text-destructive flex h-[50vh] flex-col items-center justify-center gap-2">
        <AlertCircle size={40} />
        <p>{error}</p>
        <Button onClick={fetchServices} variant="outline" className="mt-2">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="gap-4n flex flex-col items-center justify-between max-[450px]:items-start min-[400px]:flex-row">
        <div>
          <h1 className="font-heading text-foreground text-3xl font-bold">
            Prestations
          </h1>
          <p className="text-muted-foreground text-sm">
            Gérez votre catalogue et vos tarifs.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="gap-2 shadow-sm max-[400px]:mt-2"
        >
          <Plus size={18} /> Nouvelle Prestation
        </Button>
      </div>

      <Card className="border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="text-sm font-medium">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              `Catalogue (${services.length} prestations)`
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="pl-6 text-xs font-semibold uppercase italic">
                  Désignation
                </TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase">
                  Tarif horaire (HT)
                </TableHead>
                <TableHead className="pr-6 text-right text-xs font-semibold uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6">
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mx-auto h-5 w-20" />
                    </TableCell>
                    <TableCell className="flex justify-end gap-2 pr-6">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : services.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground h-32 text-center italic"
                  >
                    Aucune prestation enregistrée.
                  </TableCell>
                </TableRow>
              ) : (
                services.map((service) => (
                  <TableRow
                    key={service.id}
                    className="group hover:bg-muted/5 transition-colors"
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary group-hover:bg-primary rounded-lg p-2 transition-colors group-hover:text-white">
                          <Briefcase size={16} />
                        </div>
                        <span className="font-semibold">{service.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="bg-muted inline-flex items-center gap-1 rounded px-3 py-1 font-mono text-sm font-bold">
                        {parseFloat(service.hourly_rate).toFixed(2)} € /h
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="0 flex justify-end gap-1">
                        <Button
                          onClick={() => handleOpenEdit(service)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          onClick={() => handleOpenDelete(service)}
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                        >
                          <Trash2 size={14} />
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

      {/* 1. Modale Création / Édition */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {selectedService
                  ? 'Modifier la prestation'
                  : 'Ajouter une prestation'}
              </DialogTitle>
              <DialogDescription>
                Définissez vos tarifs pour vos factures.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Intitulé</Label>
                <Input
                  id="label"
                  name="label"
                  defaultValue={selectedService?.label}
                  required
                  placeholder="Développement Backend"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hourly_rate">Tarif horaire HT (€)</Label>
                <div className="relative">
                  <Input
                    id="hourly_rate"
                    name="hourly_rate"
                    type="number"
                    step="0.01"
                    defaultValue={selectedService?.hourly_rate}
                    required
                    className="pl-8"
                  />
                  <Euro
                    size={14}
                    className="text-muted-foreground absolute top-3 left-2.5"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Suppression */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Voulez-vous supprimer <strong>{selectedService?.label}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
