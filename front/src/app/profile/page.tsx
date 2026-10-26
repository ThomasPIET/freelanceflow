'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { storageService } from '@/services/storage.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Save, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml'];

export default function ProfilePage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);

  // Étape 1 : On met à jour la structure du formulaire
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    address_line1: '',
    address_line2: '',
    zip_code: '',
    city: '',
    country: '',
  });

  // Étape 2 : On mappe les nouveaux champs depuis l'objet user
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        address_line1: user.address_line1 || '',
        address_line2: user.address_line2 || '',
        zip_code: user.zip_code || '',
        city: user.city || '',
        country: user.country || '',
      });
    }
  }, [user]); // On simplifie la dépendance

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const { data } = await authService.updateMe(formData);
      storageService.setUser(data);
      refreshUser();
      toast.success('Profil mis à jour !');
    } catch (error: unknown) {
      // On vérifie si l'erreur vient d'Axios pour extraire le message sans utiliser "any"
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response: { data: { message: string } } }).response
              ?.data?.message
          : 'Erreur lors de la mise à jour';

      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG ou SVG.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Le fichier est trop lourd. Maximum 2MB autorisé.');
      return;
    }

    setLogoLoading(true);
    try {
      const { data } = await authService.uploadLogo(file);
      if (user) {
        storageService.setUser({ ...user, logo_data: data.logo_data });
      }
      toast.success('Logo mis à jour avec succès !');
      window.location.reload();
    } catch {
      toast.error("Erreur lors de l'upload du logo sur le serveur.");
    } finally {
      setLogoLoading(false);
    }
  };

  if (authLoading) return <ProfileSkeleton />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="font-heading text-foreground text-3xl font-bold">
          Mon Profil
        </h1>
        <p className="text-muted-foreground">
          Gérez vos informations et votre identité visuelle.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* SECTION LOGO (Identique) */}
        <Card className="border-border/50 shadow-sm md:col-span-1">
          <CardHeader className="bg-muted/20 border-b py-4">
            <CardTitle className="text-sm font-semibold tracking-wider uppercase">
              Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 py-8">
            <div className="group border-border bg-muted/30 hover:border-primary/50 relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors">
              {user?.logo_data ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.logo_data}
                  alt="Logo"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <Camera size={40} strokeWidth={1.5} />
                  <span className="text-xs">Aucun logo</span>
                </div>
              )}
              {logoLoading && (
                <div className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="text-primary animate-spin" size={24} />
                </div>
              )}
            </div>
            <div className="w-full space-y-3">
              <Label
                htmlFor="logo-upload"
                className={`bg-primary text-primary-foreground flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 ${logoLoading ? 'pointer-events-none opacity-50' : ''}`}
              >
                <Camera size={16} />
                {user?.logo_data ? 'Changer' : 'Ajouter'}
              </Label>
              <Input
                id="logo-upload"
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.svg"
                onChange={handleLogoUpload}
                disabled={logoLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* SECTION INFOS (Mise à jour) */}
        <Card className="border-border/50 shadow-sm md:col-span-2">
          <CardHeader className="bg-muted/20 border-b py-4">
            <CardTitle className="text-sm font-semibold tracking-wider uppercase">
              Détails du compte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={formData.email}
                  disabled
                  className="bg-muted/50"
                />
              </div>

              {/* BLOC ADRESSE COMPLET */}
              <div className="border-border/40 space-y-4 border-t pt-4">
                <h3 className="text-muted-foreground text-sm font-semibold uppercase">
                  Adresse
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="address_line1">Ligne 1 (N°, Rue)</Label>
                  <Input
                    id="address_line1"
                    placeholder="123 Rue de la Paix"
                    value={formData.address_line1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address_line1: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">
                    Ligne 2 (Appartement, Étage...)
                  </Label>
                  <Input
                    id="address_line2"
                    placeholder="Bâtiment B, Étage 3"
                    value={formData.address_line2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address_line2: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">Code Postal</Label>
                    <Input
                      id="zip_code"
                      placeholder="75000"
                      value={formData.zip_code}
                      onChange={(e) =>
                        setFormData({ ...formData, zip_code: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      placeholder="Paris"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    placeholder="France"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 sm:w-auto"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Sauvegarder
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Extraction du Skeleton pour plus de clarté
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center gap-6 py-8">
            <Skeleton className="h-40 w-40 rounded-xl" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="space-y-6 py-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
