import { useEffect, useState } from 'react'

function fmtTime(t) { return t ? String(t).slice(0, 5) : '' }
function money(n, currency = 'INR') { return `${currency === 'INR' ? '₹' : ''}${Number(n || 0).toFixed(2)}` }

export default function CheckoutPage({
  lockToken,
  movie,
  show,
  fetchSummary,
  createCheckout,
  verifyPayment,
  fetchSandboxHelpers,
  onBackToSeats,
  onPaymentResult,
}) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutData, setCheckoutData] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [sandboxHelpers, setSandboxHelpers] = useState(null)
  const [sandboxInputs, setSandboxInputs] = useState({ provider_payment_id: '', signature: '' })

  async function loadSummary() {
    if (!lockToken) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchSummary(lockToken)
      setSummary(data)
    } catch (err) {
      setError(err.message || 'Failed to load booking summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSummary() }, [lockToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const currency = summary?.currency || 'INR'

  async function handleCreateCheckout() {
    if (!lockToken || processing || checkoutData) return
    setProcessing(true)
    setPaymentError('')
    try {
      const data = await createCheckout(lockToken)
      setCheckoutData(data)
      // prepare sandbox helpers if sandbox
      if (data?.payment?.is_sandbox && data?.booking_id) {
        try {
          const helpers = await fetchSandboxHelpers(data.booking_id)
          setSandboxHelpers(helpers)
          setSandboxInputs({ provider_payment_id: helpers.sandbox_payment_id || '', signature: helpers.sandbox_signature || '' })
        } catch {
          // helper endpoint failure should not block manual sandbox verification input
        }
      }
    } catch (err) {
      setPaymentError(err.message || 'Failed to create booking/payment order')
    } finally {
      setProcessing(false)
    }
  }

  async function handleVerifyPayment() {
    if (!checkoutData?.booking_id || processing) return
    if (!sandboxInputs.provider_payment_id || !sandboxInputs.signature) {
      setPaymentError('Provider payment ID and signature are required to verify payment.')
      return
    }
    setProcessing(true)
    setPaymentError('')
    try {
      const res = await verifyPayment(checkoutData.booking_id, {
        provider_payment_id: sandboxInputs.provider_payment_id,
        signature: sandboxInputs.signature,
      })
      if (res.payment_status === 'CAPTURED' || res.payment_status === 'AUTHORIZED' || res.booking_status === 'CONFIRMED') {
        onPaymentResult?.({ status: 'success', bookingId: checkoutData.booking_id, result: res })
      } else {
        onPaymentResult?.({ status: 'failed', bookingId: checkoutData.booking_id, result: res, message: res.message || 'Payment verification failed.' })
      }
    } catch (err) {
      setPaymentError(err.message || 'Payment verification failed')
      onPaymentResult?.({ status: 'failed', bookingId: checkoutData.booking_id, message: err.message || 'Payment verification failed' })
    } finally {
      setProcessing(false)
    }
  }

  if (loading && !summary) return <div className="page-state">Loading booking summary...</div>
  if (error && !summary) return <div className="page-state error-state-box"><p>{error}</p><div className="hero-actions"><button className="btn-secondary" onClick={onBackToSeats}>Back to Seats</button><button className="btn-primary" onClick={loadSummary}>Retry</button></div></div>

  const display = summary || {}
  const seats = display.seats || []

  return (
    <div className="checkout-page">
      <div className="page-header-row">
        <div>
          <button className="btn-link back-link" onClick={onBackToSeats} disabled={processing}>← Back to seats</button>
          <h1>Booking Summary & Checkout</h1>
          <p>Review your booking details and complete payment. Amounts are calculated and validated by the backend.</p>
        </div>
      </div>

      {(paymentError || error) && <div className="error-state-box inline-alert"><p>{paymentError || error}</p></div>}

      <div className="checkout-grid">
        <section className="checkout-card">
          <h2>Booking Details</h2>
          <div className="summary-row"><span>Movie</span><strong>{display.movie_name || movie?.movie_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Theatre</span><strong>{display.theatre_name || show?.theatre_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Address</span><strong>{[display.theatre_address, display.theatre_city].filter(Boolean).join(', ') || 'N/A'}</strong></div>
          <div className="summary-row"><span>Screen</span><strong>{display.screen_name || show?.screen_name || 'N/A'}</strong></div>
          <div className="summary-row"><span>Show Date</span><strong>{display.show_date || show?.show_date || 'N/A'}</strong></div>
          <div className="summary-row"><span>Show Time</span><strong>{fmtTime(display.start_time || show?.start_time)} - {fmtTime(display.end_time || show?.end_time)}</strong></div>
          <div className="summary-row"><span>Selected Seats</span><strong>{seats.length ? seats.map(s => s.seat_name).join(', ') : 'N/A'}</strong></div>
          <div className="summary-row"><span>Seat Categories</span><strong>{[...new Set(seats.map(s => s.category_name || 'Standard'))].join(', ') || 'N/A'}</strong></div>

          <div className="selected-seat-lines" style={{marginTop: 10}}>
            {seats.map((s) => (
              <div key={s.seat_id} className="seat-line-item">
                <span>{s.seat_name} ({s.category_name || 'Standard'})</span>
                <span>{money(s.price, currency)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="checkout-card">
          <h2>Price Summary</h2>
          <div className="summary-row"><span>Ticket Subtotal</span><strong>{money(display.ticket_subtotal, currency)}</strong></div>
          <div className="summary-row"><span>Taxes</span><strong>{money(display.tax_amount, currency)}</strong></div>
          <div className="summary-row"><span>Convenience Fee</span><strong>{money(display.convenience_fee, currency)}</strong></div>
          <div className="summary-divider" />
          <div className="summary-row total"><span>Total Payable</span><strong>{money(display.total_payable_amount, currency)}</strong></div>
          <p className="muted-note">{display.pricing_note || 'All prices are calculated and validated by the backend. Frontend amounts are not trusted.'}</p>
          {display.lock_expires_at && <p className="muted-note">Lock expires at: {new Date(display.lock_expires_at).toLocaleString()}</p>}
        </section>

        <section className="checkout-card payment-card">
          <h2>Payment Method</h2>
          {!checkoutData ? (
            <>
              <div className="payment-method-option selected">
                <div>
                  <strong>Sandbox/Test Payment (Isolated)</strong>
                  <p className="muted-note">No live payment provider is configured in this environment. This isolated sandbox flow is for development/testing only and must not be represented as a real successful transaction.</p>
                </div>
              </div>
              <div className="summary-actions" style={{marginTop: 12}}>
                <button className="btn-primary" onClick={handleCreateCheckout} disabled={processing || !summary}>
                  {processing ? 'Creating booking/payment order...' : 'Create Booking & Initiate Payment'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="payment-processing-state">
                <p><strong>Booking:</strong> {checkoutData.booking_reference} ({checkoutData.booking_status})</p>
                <p><strong>Payment Order:</strong> {checkoutData.payment?.provider_order_id || 'N/A'}</p>
                <p><strong>Provider:</strong> {checkoutData.payment?.provider} {checkoutData.payment?.is_sandbox ? '(Sandbox/Test)' : ''}</p>
                <p><strong>Amount:</strong> {money(checkoutData.payment?.amount ?? checkoutData.total_payable_amount, checkoutData.currency || currency)}</p>
              </div>
              <div className="sandbox-verify-form">
                <h3>Sandbox Payment Verification</h3>
                <p className="muted-note">Use the generated sandbox payment ID and signature below (or enter verified sandbox values) to simulate provider-verified payment evidence. Booking is confirmed only after server-side signature verification.</p>
                {sandboxHelpers?.warning && <p className="muted-note warning-note">{sandboxHelpers.warning}</p>}
                <label>
                  <span>Provider Payment ID (sandbox)</span>
                  <input value={sandboxInputs.provider_payment_id} onChange={(e) => setSandboxInputs({ ...sandboxInputs, provider_payment_id: e.target.value })} placeholder="sandbox_pay_..." />
                </label>
                <label>
                  <span>Payment Signature (sandbox HMAC)</span>
                  <input value={sandboxInputs.signature} onChange={(e) => setSandboxInputs({ ...sandboxInputs, signature: e.target.value })} placeholder="signature..." />
                </label>
                <div className="summary-actions">
                  <button className="btn-primary" onClick={handleVerifyPayment} disabled={processing}>
                    {processing ? 'Processing payment verification...' : 'Verify Payment & Confirm Booking'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
