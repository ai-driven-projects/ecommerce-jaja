import type { Metadata } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import { AuthProvider } from '@/modules/auth/data/auth.context';
import { Toaster } from '@/shared/components/ui/toaster';
import './globals.css';

// Manrope: todo o texto e UI (eixo variável 400–800).
const fontUi = Manrope({
  variable: '--font-ui',
  subsets: ['latin'],
  display: 'swap',
});

// Bricolage Grotesque: display — logo, títulos, preços grandes e KPIs.
const fontDisplay = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'já já — entrega rápida para escritórios',
  description: 'Papel, toner, café e tudo que o seu escritório consome, entregue de bike em minutos.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${fontUi.variable} ${fontDisplay.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
