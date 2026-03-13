'use client'

import { StakeholderPage } from '@/components/stakeholder/StakeholderPage'

export default function StakeholderRoute() {
  return (
    <StakeholderPage
      audienceLabel="Stakeholder"
      summaryPath="/api/stakeholder/summary"
      exportPath="/api/stakeholder/export"
    />
  )
}
