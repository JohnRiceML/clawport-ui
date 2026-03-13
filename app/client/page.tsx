'use client'

import { StakeholderPage } from '@/components/stakeholder/StakeholderPage'

export default function ClientRoute() {
  return (
    <StakeholderPage
      audienceLabel="Client"
      summaryPath="/api/client/summary"
      exportPath="/api/client/export"
    />
  )
}
