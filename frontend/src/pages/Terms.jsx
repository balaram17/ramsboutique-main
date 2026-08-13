import React from "react";
import { Link } from "react-router-dom";

const Terms = () => (
  <main className="min-h-screen bg-gray-50 py-10">
    <div className="mx-auto max-w-4xl px-4">
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-600 hover:text-black">← Back to Home</Link>
      </div>
      <article className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms & Conditions</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: August 13, 2026</p>

        <Section title="1. Introduction">
          Welcome to Rams Boutique. By accessing or using our website, placing an order, or using our services, you agree to these Terms & Conditions. If you do not agree, please do not use the website.
        </Section>
        <Section title="2. Products and Information">
          We make reasonable efforts to ensure that product descriptions, images, prices, availability and other information are accurate. Product appearance may vary slightly from images shown online. We reserve the right to correct errors and update product information at any time.
        </Section>
        <Section title="3. Prices and Payments">
          Prices displayed on the website are in Indian Rupees unless otherwise stated. Applicable delivery charges, discounts and taxes, where applicable, will be shown during checkout. Payments may be processed through the payment methods made available on the website.
        </Section>
        <Section title="4. Orders">
          An order is considered placed after you complete checkout and receive an order confirmation. We may cancel or refuse an order where a product is unavailable, information is incorrect, payment cannot be verified, or circumstances outside our reasonable control prevent fulfillment.
        </Section>
        <Section title="5. Delivery">
          Delivery availability, estimated delivery times and delivery charges may depend on your location, product availability, traffic, weather and other operational conditions. Delivery estimates are not guaranteed unless specifically stated.
        </Section>
        <Section title="6. Cancellations, Returns and Refunds">
          Cancellation, return and refund requests are subject to our Returns & Refunds policy. Some products, particularly perishable or opened products, may not be eligible for return unless they are damaged, defective or incorrectly supplied.
        </Section>
        <Section title="7. User Accounts">
          You are responsible for maintaining the confidentiality of your account information and for activity performed through your account. Please notify us promptly if you believe your account has been accessed without authorization.
        </Section>
        <Section title="8. Website Use">
          You agree not to misuse the website, interfere with its operation, attempt unauthorized access, introduce malicious code, or use the website for unlawful purposes.
        </Section>
        <Section title="9. Intellectual Property">
          Website content, branding, logos, graphics, text and other materials belonging to Rams Boutique may not be copied, reproduced, modified or distributed without permission, except where permitted by law.
        </Section>
        <Section title="10. Limitation of Liability">
          To the extent permitted by applicable law, Rams Boutique will not be responsible for indirect or consequential losses arising from website use, delays, service interruptions, or circumstances outside our reasonable control.
        </Section>
        <Section title="11. Changes">
          We may update these Terms & Conditions from time to time. Updated terms will be published on this page. Continued use of the website after changes are published constitutes acceptance of the updated terms.
        </Section>
        <Section title="12. Contact">
          For questions about these terms, contact us at <a className="font-medium underline" href="mailto:info@ramsboutique.com">info@ramsboutique.com</a>.
        </Section>
      </article>
    </div>
  </main>
);

const Section = ({ title, children }) => (
  <section className="mb-7">
    <h2 className="mb-2 text-xl font-semibold text-gray-900">{title}</h2>
    <p className="leading-7 text-gray-700">{children}</p>
  </section>
);

export default Terms;
