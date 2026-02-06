'use client';

/**
 * Theme Preview Page
 * This page is loaded in an iframe to show theme previews
 */

export default function ThemePreviewPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Store Name</h1>
            <nav className="flex gap-6">
              <a href="#" className="hover:text-primary">Shop</a>
              <a href="#" className="hover:text-primary">About</a>
              <a href="#" className="hover:text-primary">Contact</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-muted py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Welcome to Our Store</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Discover amazing products at great prices
          </p>
          <button className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-semibold hover:bg-primary/90">
            Shop Now
          </button>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold mb-8">Featured Products</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card border rounded-lg overflow-hidden">
                <div className="aspect-square bg-muted"></div>
                <div className="p-4">
                  <h4 className="font-semibold mb-2">Product {i}</h4>
                  <p className="text-muted-foreground text-sm mb-4">
                    Amazing product description here
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">$99.99</span>
                    <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90">
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-12 py-8 bg-muted/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Store Name. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
