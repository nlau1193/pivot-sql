import { useEffect, useState } from 'react'
import { EvidenceSeal, type EvidenceSealProps } from './EvidenceSeal'

interface BadgeRevealProps extends Omit<EvidenceSealProps, 'animate'> {
  acknowledged: boolean
  animateReveal?: boolean
  onAcknowledge: (badgeId: string) => void
}

/**
 * Captures the reveal decision once. We acknowledge immediately so a reload,
 * revisit, import, or Retake cannot replay the seal, while the mounted seal is
 * still allowed to finish its single 640 ms delivery motion.
 */
export function BadgeReveal({ acknowledged, animateReveal = false, onAcknowledge, ...seal }: BadgeRevealProps) {
  const [reveal] = useState(() => !!seal.earned && !acknowledged && animateReveal)
  useEffect(() => {
    // Backfilled catalog seals are acknowledged without replaying a wall of
    // motion. CareerDossier selects at most one genuinely new reveal.
    if (seal.earned && !acknowledged) onAcknowledge(seal.id)
  }, [acknowledged, onAcknowledge, seal.earned, seal.id])
  return <EvidenceSeal {...seal} animate={reveal} />
}
