import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

const ContactUs = () => {
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6">
          <Link to="/" className="text-sm text-gray-600 hover:text-black">← Back to Home</Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Contact Us</h1>
            <p className="mb-8 text-gray-600">We're happy to help with orders, products, delivery and other questions.</p>

            <div className="space-y-5">
              <Info icon={<MapPin size={20} />} title="Address">
                Dwaraka Nagar, Visakhapatnam, Andhra Pradesh 530016
              </Info>
              <Info icon={<Phone size={20} />} title="Phone">
                <a href="tel:+918074763983" className="hover:underline">807-476-3983</a>
              </Info>
              <Info icon={<Mail size={20} />} title="Email">
                <a href="mailto:info@ramsboutique.com" className="hover:underline">info@ramsboutique.com</a>
              </Info>
              <Info icon={<Clock size={20} />} title="Business Hours">
                7:00 AM – 10:00 PM
              </Info>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-5 text-2xl font-semibold text-gray-900">Send us a message</h2>
            {sent ? (
              <div className="rounded-xl bg-gray-50 p-5 text-gray-700">
                <h3 className="mb-2 font-semibold">Thank you!</h3>
                <p>Your message has been prepared. Please use the email option below if your website does not yet have a contact-form backend.</p>
                <a
                  className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-white"
                  href="mailto:info@ramsboutique.com"
                >
                  Email BTA FreshMart
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <input required className="w-full rounded-lg border p-3" placeholder="Your name" />
                <input required type="email" className="w-full rounded-lg border p-3" placeholder="Email address" />
                <input className="w-full rounded-lg border p-3" placeholder="Order number (optional)" />
                <textarea required rows="5" className="w-full rounded-lg border p-3" placeholder="How can we help?" />
                <button type="submit" className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:opacity-90">
                  Submit
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

const Info = ({ icon, title, children }) => (
  <div className="flex gap-4">
    <div className="mt-1">{icon}</div>
    <div>
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-gray-600">{children}</div>
    </div>
  </div>
);

export default ContactUs;
