/** In-flight UPI pay — keep the Pay sheet mounted while the user is in PhonePe/GPay. */

let inflight = 0;

export function beginPaymentFlight() {
  inflight += 1;
}

export function endPaymentFlight() {
  inflight = Math.max(0, inflight - 1);
}

export function isPaymentInFlight() {
  return inflight > 0;
}
