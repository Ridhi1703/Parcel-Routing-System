import client from './client'

export const listRules = () => client.get('/rules')
export const createDraft = (config) => client.post('/rules/draft', { config })
export const testRule = (id, parcels) => client.post(`/rules/${id}/test`, { parcels })
export const applyRule = (id) => client.put(`/rules/${id}/apply`)
export const diffRules = (id, compareToId) =>
  client.get(`/rules/${id}/diff`, { params: { compare_to: compareToId } })

export const deleteDraft = (id) => client.delete(`/rules/${id}`)
