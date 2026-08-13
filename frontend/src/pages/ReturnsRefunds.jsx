import React from "react";
import { Link } from "react-router-dom";

const ReturnsRefunds = () => (
  <main className="min-h-screen bg-gray-50 py-10">
    <div className="mx-auto max-w-4xl px-4">
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-600 hover:text-black">← Back to Home</Link>
      </div>
      <article className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Returns & Refunds</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: August 13, 2026</p>

        <Section title="1. Our Commitment">
          We want you to receive your order in good condition and as described. If you receive a wrong, damaged or defective item, please contact us as soon as possible so we can review the issue.
        </Section>
        <Section title="2. Eligible Returns">
          Returns may be accepted for items that are damaged, defective, incorrect, or materially different from the item ordered, subject to verification. The item may need to be unused and in its original condition where practical.
        </Section>
        <Section title="3. Perishable Products">
          Perishable, fresh, opened or temperature-sensitive products may generally not be eligible for return because of their nature. If such an item arrives damaged, spoiled or incorrect, contact us promptly with details and photographs where possible.
        </Section>
        <Section title="4. Wrong or Missing Items">
          If an item is missing or you receive an item different from what you ordered, contact us with your order number and details. We will investigate and, where appropriate, arrange a replacement or refund.
        </Section>
        <Section title="5. Damaged Products">
          Please report damaged products as soon as reasonably possible after delivery. Photographs of the packaging and product can help us process your request faster.
        </Section>
        <Section title="6. Order Cancellation">
          Cancellation may be possible before an order is prepared or dispatched. Once an order has progressed to fulfillment or delivery, cancellation may not be possible.
        </Section>
        <Section title="7. Refunds">
          Approved refunds will normally be issued to the original payment method where technically possible. The time taken for the amount to appear in your account may depend on the payment provider or bank.
        </Section>
        <Section title="8. Refund Exclusions">
          Refunds may not be available for change of mind, incorrect information supplied by the customer, misuse of a product, or issues reported outside the applicable return period, except where required by applicable law.
        </Section>
        <Section title="9. How to Request Help">
          Send your order number, registered contact details, the issue description and supporting photographs (if applicable) to <a className="font-medium underline" href="mailto:info@ramsboutique.com">info@ramsboutique.com</a>.
        </Section>
        <Section title="10. Policy Updates">
          We may update this policy from time to time. The version displayed on this page is the current version published by Rams Boutique.
        </Section>

        <div className="mt-8 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <strong>Note:</strong> Specific return windows, exclusions and refund timelines should be updated to match your final business policy before publishing.
        </div>
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

export default ReturnsRefunds;
