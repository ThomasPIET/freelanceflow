'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { userService, AdminUser } from '@/services/user.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    userService
      .getAll()
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Impossible de charger les comptes.'))
      .finally(() => setIsLoading(false));
  }, [isAdmin]);

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await userService.delete(selected.id);
      setUsers((current) => current.filter((u) => u.id !== selected.id));
      toast.success(`Compte ${selected.email} supprimé.`);
      setSelected(null);
    } catch {
      toast.error('Erreur lors de la suppression du compte.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <ShieldAlert className="text-destructive h-10 w-10" />
          <p className="font-semibold">Accès réservé aux administrateurs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-foreground text-3xl font-bold">
          Administration
        </h1>
        <p className="text-muted-foreground">
          Gérez les comptes de la plateforme.
        </p>
      </header>

      <Card>
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold tracking-wider uppercase">
            Comptes ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>
                      {account.first_name} {account.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          account.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {account.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(account.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.role === 'standard' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Supprimer ${account.email}`}
                          onClick={() => setSelected(account)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Supprimer le compte
            </DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer <strong>{selected?.email}</strong>{' '}
              et toutes ses données ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
