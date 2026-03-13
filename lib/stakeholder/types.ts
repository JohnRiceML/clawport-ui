export type StakeholderStatus = 'on_track' | 'needs_attention' | 'blocked'
export type StakeholderRange = '24h' | '7d' | '30d'

export interface StakeholderOutcomeItem {
  id: string
  title: string
  summary: string
  ownerAgentId: string | null
  ownerName: string
  ts: number
}

export interface StakeholderDeliverable {
  id: string
  jobId: string
  title: string
  summary: string
  deliveredAt: number
  ownerAgentId: string | null
  ownerName: string
  channel: string | null
  destinationLabel: string | null
}

export interface StakeholderRiskItem {
  id: string
  title: string
  summary: string
  severity: 'low' | 'medium' | 'high'
  ownerAgentId: string | null
  ownerName: string | null
  relatedJobId: string | null
  detectedAt: number
}

export interface StakeholderUpcomingItem {
  jobId: string
  title: string
  nextRun: string
  ownerAgentId: string | null
  ownerName: string | null
  expectedChannel: string | null
}

export interface StakeholderSummary {
  range: StakeholderRange
  generatedAt: string
  overallStatus: StakeholderStatus
  executiveSummary: string
  outcomes: StakeholderOutcomeItem[]
  deliverables: StakeholderDeliverable[]
  risks: StakeholderRiskItem[]
  upcoming: StakeholderUpcomingItem[]
  metrics: {
    successfulDeliveries: number
    failedDeliveries: number
    openRisks: number
    completedOutputs: number
  }
}
