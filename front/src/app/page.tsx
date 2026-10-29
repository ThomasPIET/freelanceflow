import { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Freelance Flow',
  description: 'La facturation simple pour les indépendants',
};

const features = [
  {
    title: 'Clients',
    description: 'Centralisez les coordonnées de vos clients.',
  },
  {
    title: 'Prestations',
    description: 'Gérez votre catalogue de services et vos tarifs.',
  },
  {
    title: 'Factures',
    description:
      'Créez vos factures, téléchargez-les en PDF et envoyez-les par e-mail.',
  },
];

// Page publique : seule page accessible sans être connecté, avec /login et /register
export default async function Home() {
  const isLoggedIn = (await cookies()).has('token');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 p-6 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="font-heading text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
          FreelanceFlow
        </h1>
        <p className="text-muted-foreground text-lg">
          La facturation simple pour les indépendants : vos clients, vos
          prestations et vos factures au même endroit.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {isLoggedIn ? (
          <Link
            href="/homepage"
            className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-md px-5 py-2.5 text-sm font-medium"
          >
            Accéder au tableau de bord
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-md px-5 py-2.5 text-sm font-medium"
            >
              Créer un compte
            </Link>
            <Link
              href="/login"
              className="border-border bg-background hover:bg-muted rounded-md border px-5 py-2.5 text-sm font-medium"
            >
              Se connecter
            </Link>
          </>
        )}
      </div>

      <ul className="grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title} className="bg-card rounded-xl border p-5">
            <h2 className="text-foreground font-semibold">{feature.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {feature.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
