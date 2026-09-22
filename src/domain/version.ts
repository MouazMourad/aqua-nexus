/**
 * Auditable release/model identifiers.
 *
 * Product version follows package.json. Decision-model versions change only when
 * the meaning of a calculated decision/snapshot changes.
 */
export const AQUA_NEXUS_VERSION="0.3.0-rc.2";
export const TANK_BRAIN_VERSION="1.0.0";
export const HEALTH_MODEL_VERSION="2.0.0";
export const CHEMISTRY_EVIDENCE_VERSION="1.0.0";

export const AQUA_MODEL_VERSIONS={
  tankBrain:TANK_BRAIN_VERSION,
  health:HEALTH_MODEL_VERSION,
  chemistryEvidence:CHEMISTRY_EVIDENCE_VERSION
} as const;
