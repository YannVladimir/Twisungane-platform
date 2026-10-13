import api from './api.js'

const exitService = {
  checkEligibility: (memberId) =>
    api.get(`/api/v1/members/${memberId}/exit/eligibility`),

  getSettlement: (memberId) =>
    api.get(`/api/v1/members/${memberId}/exit/settlement`),

  initiateExit: (memberId, payload) =>
    api.post(`/api/v1/members/${memberId}/exit/initiate`, payload),

  getMemberExitHistory: (memberId) =>
    api.get(`/api/v1/members/${memberId}/exit/history`),

  getPendingExitRequests: () =>
    api.get('/api/v1/members/exit-requests/pending'),

  getAllExitRequests: () =>
    api.get('/api/v1/members/exit-requests'),

  approveExit: (exitRequestId) =>
    api.post(`/api/v1/members/exit-requests/${exitRequestId}/approve`, {}),

  rejectExit: (exitRequestId, rejectionReason) =>
    api.post(`/api/v1/members/exit-requests/${exitRequestId}/reject`, { rejectionReason }),

  recordPayout: (exitRequestId, payoutReference) =>
    api.post(`/api/v1/members/exit-requests/${exitRequestId}/payout`, { payoutReference }),
}

export default exitService
