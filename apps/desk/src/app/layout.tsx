import './global.css';

export const metadata = {
  title: 'NoSlag Desk → Workspace (redirect)',
  description: 'The Desk surface has been unified into the main NoSlag workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
