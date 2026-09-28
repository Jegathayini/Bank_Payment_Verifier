document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
  loadSubmissions();

  const form = document.getElementById('paymentForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const orderId = document.getElementById('orderSelect').value;
    const fileInput = document.getElementById('paymentSlip');

    if (!orderId || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('paymentSlip', fileInput.files[0]);

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = 'Processing OCR & Verifying...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      // Render Result UI
      const resultBox = document.getElementById('resultBox');
      const badge = document.getElementById('decisionBadge');
      
      badge.innerText = data.decision;
      badge.className = data.decision.replace(' ', '_');

      document.getElementById('decisionReason').innerText = data.decisionReason;
      document.getElementById('customerMsg').innerText = data.customerMessage;

      resultBox.classList.remove('hidden');

      // Refresh Audit Log
      loadSubmissions();
    } catch (err) {
      alert('Error verifying payment. Check console.');
    } finally {
      submitBtn.innerText = 'Submit & Verify Payment';
      submitBtn.disabled = false;
    }
  });
});

async function loadOrders() {
  const res = await fetch('/api/orders');
  const orders = await res.json();
  const select = document.getElementById('orderSelect');

  select.innerHTML = '<option value="">-- Select Pending Order --</option>';
  orders.forEach(o => {
    select.innerHTML += `<option value="${o.order_id}">${o.order_id} - ${o.customer_name} (Rs. ${o.expected_amount})</option>`;
  });
}

async function loadSubmissions() {
  const res = await fetch('/api/submissions');
  const submissions = await res.json();
  const tbody = document.getElementById('submissionsTable');

  if (submissions.length === 0) return;

  tbody.innerHTML = submissions.map(s => `
    <tr>
      <td>${s.submission_id}</td>
      <td>${s.order_id}</td>
      <td>${s.extracted_ref_no || 'N/A'}</td>
      <td class="${s.decision.replace(' ', '_')}">${s.decision}</td>
      <td>${s.decision_reason}</td>
      <td>${new Date(s.created_at).toLocaleString()}</td>
    </tr>
  `).join('');
}