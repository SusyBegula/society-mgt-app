export default {
  async open(_options: unknown): Promise<{razorpay_payment_id:string;razorpay_order_id:string;razorpay_signature:string}> {
    throw new Error("Use the resident mobile app to make an online maintenance payment.");
  }
};
