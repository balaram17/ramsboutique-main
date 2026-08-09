import api from './api';

const RZP_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve(true);
  const existing = document.querySelector(`script[src="${RZP_SCRIPT}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(true));
    existing.addEventListener('error', () => reject(new Error('Razorpay SDK failed to load')));
    return;
  }
  const s = document.createElement('script');
  s.src = RZP_SCRIPT;
  s.async = true;
  s.onload = () => resolve(true);
  s.onerror = () => reject(new Error('Razorpay SDK failed to load. Check your internet.'));
  document.body.appendChild(s);
});

/**
 * Opens the Razorpay Checkout modal for the given internal order.
 * @param {object} args - { orderId, name, phone, email }
 * @returns Promise resolving to the verified server response (order doc) on success.
 */
export const openRazorpayCheckout = async ({ orderId, name, phone, email }) => {
  await loadRazorpayScript();

  const { data: rzpOrder } = await api.post('/payments/razorpay/create-order', { order_id: orderId });

  return new Promise((resolve, reject) => {
    const options = {
      key: rzpOrder.key_id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: 'Rams Boutique',
      description: `Order ${rzpOrder.order_no}`,
      order_id: rzpOrder.razorpay_order_id,
      prefill: {
        name: name || '',
        contact: phone || '',
        email: email || '',
      },
      theme: { color: '#6b3410' },
      handler: async (response) => {
        try {
          const { data } = await api.post('/payments/razorpay/verify', {
            order_id: orderId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve(data);
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: async () => {
          try { await api.post('/payments/razorpay/cancel', { order_id: orderId }); } catch (_) {}
          reject(new Error('Payment cancelled'));
        },
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', async () => {
      try { await api.post('/payments/razorpay/cancel', { order_id: orderId }); } catch (_) {}
      reject(new Error('Payment failed'));
    });
    rzp.open();
  });
};
