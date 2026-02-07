export interface LegalPageTemplate {
  slug: string;
  title: string;
  content: string;
}

export const DEFAULT_LEGAL_PAGES: LegalPageTemplate[] = [
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    content: `<h2>Terms of Service</h2>
<p>Last updated: {{date}}</p>

<h3>1. Agreement to Terms</h3>
<p>By accessing or using the {{businessName}} online store, you agree to be bound by these Terms of Service. If you do not agree, please do not use our store.</p>

<h3>2. Products and Pricing</h3>
<p>All product descriptions, images, and prices are subject to change without notice. We reserve the right to modify or discontinue any product at any time. Prices are displayed in the currency shown at checkout and include applicable taxes unless otherwise stated.</p>

<h3>3. Orders and Payment</h3>
<p>By placing an order, you are making an offer to purchase. We reserve the right to accept or decline any order. Payment is processed securely through our payment provider. You agree to provide accurate billing and shipping information.</p>

<h3>4. Shipping and Delivery</h3>
<p>Shipping times are estimates and not guaranteed. {{businessName}} is not responsible for delays caused by carriers, customs, or events beyond our control. Risk of loss passes to you upon delivery to the carrier.</p>

<h3>5. Limitation of Liability</h3>
<p>To the maximum extent permitted by law, {{businessName}} shall not be liable for any indirect, incidental, or consequential damages arising from your use of our store or products.</p>

<h3>6. Changes to Terms</h3>
<p>We may update these terms at any time. Continued use of the store after changes constitutes acceptance of the updated terms.</p>

<h3>7. Contact</h3>
<p>For questions about these terms, please contact us at {{email}}.</p>`,
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    content: `<h2>Privacy Policy</h2>
<p>Last updated: {{date}}</p>

<h3>1. Information We Collect</h3>
<p>When you visit {{businessName}} or make a purchase, we collect:</p>
<ul>
<li><strong>Personal information:</strong> name, email address, shipping address, phone number</li>
<li><strong>Payment information:</strong> processed securely by our payment provider (we do not store card details)</li>
<li><strong>Usage data:</strong> pages visited, browser type, IP address</li>
</ul>

<h3>2. How We Use Your Information</h3>
<p>We use your information to:</p>
<ul>
<li>Process and fulfill your orders</li>
<li>Send order confirmations and shipping updates</li>
<li>Respond to customer service requests</li>
<li>Improve our store and products</li>
<li>Send marketing communications (only with your consent)</li>
</ul>

<h3>3. Information Sharing</h3>
<p>We do not sell your personal information. We share data only with:</p>
<ul>
<li>Payment processors to complete transactions</li>
<li>Shipping carriers to deliver orders</li>
<li>Service providers who assist in operating our store</li>
</ul>

<h3>4. Data Security</h3>
<p>We implement industry-standard security measures to protect your information, including encryption of data in transit and at rest.</p>

<h3>5. Your Rights</h3>
<p>You may request access to, correction of, or deletion of your personal data by contacting us at {{email}}.</p>

<h3>6. Cookies</h3>
<p>We use essential cookies for cart functionality and session management. Analytics cookies are used only with your consent.</p>

<h3>7. Contact</h3>
<p>For privacy-related questions, contact us at {{email}}.</p>`,
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Return Policy',
    content: `<h2>Refund & Return Policy</h2>
<p>Last updated: {{date}}</p>

<h3>1. Returns</h3>
<p>We accept returns within 30 days of delivery. Items must be unused, in original packaging, and in the same condition you received them.</p>

<h3>2. How to Initiate a Return</h3>
<p>To start a return, contact us at {{email}} with your order number and reason for return. We will provide return shipping instructions.</p>

<h3>3. Refunds</h3>
<p>Once we receive and inspect the returned item, we will notify you of the refund status. Approved refunds are processed to your original payment method within 5-10 business days.</p>

<h3>4. Exchanges</h3>
<p>For exchanges, please return the original item and place a new order for the replacement.</p>

<h3>5. Non-Returnable Items</h3>
<ul>
<li>Gift cards</li>
<li>Personalized or custom-made items</li>
<li>Items marked as final sale</li>
</ul>

<h3>6. Damaged or Defective Items</h3>
<p>If you receive a damaged or defective item, contact us within 7 days of delivery at {{email}}. We will arrange a replacement or full refund at no extra cost.</p>

<h3>7. Shipping Costs</h3>
<p>Return shipping costs are the responsibility of the customer, unless the return is due to our error (wrong item, defective product).</p>`,
  },
];
