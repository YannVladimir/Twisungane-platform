import api from './api.js'

const BASE = '/api/v1/amendments'

const requestAmendment = async ({ transactionType, originalTransactionId, originalAmount, correctAmount, reason, amendmentDetails }) => {
  const res = await api.post(BASE, {
    transactionType,
    originalTransactionId,
    originalAmount: parseFloat(originalAmount),
    correctAmount: parseFloat(correctAmount),
    reason,
    amendmentDetails: amendmentDetails || null,
  })
  return res.data
}

const getPendingAmendments = async () => {
  const res = await api.get(`${BASE}/pending`)
  return res.data
}

const getAllAmendments = async () => {
  const res = await api.get(BASE)
  return res.data
}

const approveAmendment = async (id) => {
  const res = await api.post(`${BASE}/${id}/approve`)
  return res.data
}

const rejectAmendment = async (id, reason) => {
  const res = await api.post(`${BASE}/${id}/reject`, { reason })
  return res.data
}

const cancelAmendment = async (id) => {
  const res = await api.post(`${BASE}/${id}/cancel`)
  return res.data
}

const amendmentService = {
  requestAmendment,
  getPendingAmendments,
  getAllAmendments,
  approveAmendment,
  rejectAmendment,
  cancelAmendment,
}

export default amendmentService
