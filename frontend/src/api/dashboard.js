import client from './client'

export const getSummary = () => client.get('/dashboard/summary')
export const getDashboardParcels = (params) => client.get('/dashboard/parcels', { params })
export const getAuditLog = (params) => client.get('/dashboard/audit', { params })
export const getBatchProgress = (id) => client.get(`/dashboard/batch/${id}`)
export const getDLQ = () => client.get('/dashboard/dlq')
