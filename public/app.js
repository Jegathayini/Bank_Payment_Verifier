document.addEventListener('DOMContentLoaded', () => {
  const verifyForm = document.getElementById('verifyForm');
  const resultContainer = document.getElementById('resultContainer');

  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const orderId = document.getElementById('orderId').value;
      const fileInput = document.getElementById('paymentSlip');
      
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a payment slip image to upload.');
        return;
      }

      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('paymentSlip', fileInput.files[0]);

      if (resultContainer) {
        resultContainer.style.display = 'block';
        resultContainer.className = 'badge-secondary';
        resultContainer.innerHTML = '<p><strong>Processing...</strong> Extracting receipt text and verifying with bank SMS records.</p>';
      }

      try {
        const response = await fetch('/api/verify', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok && resultContainer) {
          const extractedAmount = data.extractedAmount ? `LKR ${data.extractedAmount}` : 'Not detected';
          const extractedRef = data.extractedRefNo || 'Not detected';

          if (data.decision === 'MATCH' || data.decision === 'VERIFIED') {
            resultContainer.className = 'badge-success';
            resultContainer.innerHTML = `
              <h4 style="margin-bottom: 0.5rem; color: #166534;">✓ Payment Verified Successfully</h4>
              <p><strong>Reason:</strong> ${data.decisionReason || 'Slip data matches bank record.'}</p>
              <p><strong>Extracted Amount:</strong> ${extractedAmount}</p>
              <p><strong>Extracted Ref No:</strong> ${extractedRef}</p>
              <p style="margin-top: 0.5rem;"><strong>Message:</strong> ${data.customerMessage || ''}</p>
            `;
          } else {
            resultContainer.className = 'badge-danger';
            resultContainer.innerHTML = `
              <h4 style="margin-bottom: 0.5rem; color: #991b1b;">✕ Verification Failed</h4>
              <p><strong>Reason:</strong> ${data.decisionReason || 'Slip could not be verified.'}</p>
              <p><strong>Extracted Amount from Receipt:</strong> <strong>${extractedAmount}</strong></p>
              <p><strong>Extracted Reference No:</strong> <strong>${extractedRef}</strong></p>
              <p style="margin-top: 0.5rem;"><strong>Message:</strong> ${data.customerMessage || 'Please submit a clearer payment receipt.'}</p>
            `;
          }
        } else if (resultContainer) {
          resultContainer.className = 'badge-danger';
          resultContainer.innerHTML = `<p><strong>Error:</strong> ${data.error || 'Failed to verify payment slip.'}</p>`;
        }
      } catch (err) {
        console.error('Verification request error:', err);
        if (resultContainer) {
          resultContainer.className = 'badge-danger';
          resultContainer.innerHTML = '<p><strong>Server Error:</strong> Unable to reach verification server.</p>';
        }
      }
    });
  }
});