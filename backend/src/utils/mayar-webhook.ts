type PaymentData = {
  id?: string;
  transactionId?: string;
  transaction_id?: string;
  payment_id?: string;
  productId?: string;
  productType?: string;
};

// Mayar's documented payment-request callbacks have no root delivery ID.
// Explicit IDs remain compatible with previously persisted webhook events.
export function getMayarEventId(payload: {id?: unknown; event?: unknown; data?: PaymentData}): string | null {
  if (payload.id !== undefined) {
    return typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
  }
  if (['payment.received', 'payment.reminder'].includes(String(payload.event)) &&
      payload.data?.productType === 'payment_request' &&
      typeof payload.data.productId === 'string' && payload.data.productId.trim() &&
      typeof payload.data.transactionId === 'string' && payload.data.transactionId.trim()) {
    return `${payload.event}:${payload.data.transactionId.trim()}`;
  }
  return null;
}

export function getMayarPaymentReferences(data: PaymentData) {
  return {
    checkoutReference: data.productType === 'payment_request' ? data.productId : data.id,
    providerPaymentId: data.transactionId || data.transaction_id || data.payment_id || data.id
  };
}
