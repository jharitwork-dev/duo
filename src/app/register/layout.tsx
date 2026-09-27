import { IBM_Plex_Sans_Thai_Looped, League_Spartan } from 'next/font/google';
import localFont from 'next/font/local';

const ibmPlexThaiLooped = IBM_Plex_Sans_Thai_Looped({
  subsets: ['thai', 'latin'],
  weight: ['400', '700'],
  variable: '--font-thai',
  display: 'swap',
});

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const fcRainbow = localFont({
  src: '../../../public/fonts/FCRainbow-Regular.ttf',
  variable: '--font-display',
  display: 'swap',
});

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${ibmPlexThaiLooped.variable} ${leagueSpartan.variable} ${fcRainbow.variable}`}>
      {children}
    </div>
  );
}
