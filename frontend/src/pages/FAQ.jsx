import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

const questions = [
  ["How do I place an order?", "Browse our products, add the items you want to your cart, proceed to checkout, enter your delivery details and complete payment or select the available payment option."],
  ["Where does BTA FreshMart deliver?", "Our current service area is based around Visakhapatnam. Delivery availability is confirmed according to the delivery address entered during checkout."],
  ["How much is delivery?", "Applicable delivery charges are shown during checkout. Promotional offers may provide free delivery subject to the offer conditions."],
  ["How can I track my order?", "Use the Track Order page or your account's orders section to view available order information and status updates."],
  ["Can I cancel my order?", "Cancellation may be possible before the order is prepared or dispatched. Contact us as soon as possible with your order number."],
  ["Can I return an item?", "Eligible returns depend on the product and the reason for return. Damaged, defective or incorrect items should be reported promptly. See our Returns & Refunds policy."],
  ["What if I receive a damaged or wrong product?", "Contact us promptly with your order number, a description of the issue and photographs where possible. We will review the request and advise on the next step."],
  ["How long do refunds take?", "Once a refund is approved, the time for the money to appear in your account can depend on your bank or payment provider."],
  ["What payment methods are available?", "Available payment methods are displayed during checkout. Payment processing may be handled by a third-party payment provider."],
  ["How can I contact BTA FreshMart?", "Email us at info@ramsboutique.com or use our Contact Us page."],
];

const FAQ = () => {
  const [open, setOpen] = useState(null);

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <Link to="/" className="text-sm text-gray-600 hover:text-black">← Back to Home</Link>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
          <p className="mb-8 text-gray-600">Find answers to common questions about BTA FreshMart.</p>

          <div className="divide-y rounded-xl border">
            {questions.map(([question, answer], index) => (
              <div key={question}>
                <button
                  type="button"
                  onClick={() => setOpen(open === index ? null : index)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-medium text-gray-900">{question}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 transition-transform ${open === index ? "rotate-180" : ""}`}
                  />
                </button>
                {open === index && (
                  <div className="px-5 pb-5 leading-7 text-gray-600">{answer}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export default FAQ;
