/** Documentary development provenance; never a runtime rule dependency. */
export interface Metadata {
  sourceReview?: string;
  requirementRefs?: string[];
  sourceRegisterRefs?: string[];
}

/** Exact identity/version pair. String formats require runtime validation. */
export interface DefinitionReference {
  id: string;
  version: string;
}
