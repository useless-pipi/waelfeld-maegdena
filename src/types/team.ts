import type { Bonus } from './stats';

export interface CompositionChoice {
  id: string;
  name: string;
  description: string;
  /** Requirements to unlock the bonus, e.g. {qualificationId: "primary_scout", minCount: 2} */
  requirements: CompositionRequirement[];
  bonuses: Bonus[];
}

export interface CompositionRequirement {
  /** type of requirement */
  type: 'qualification' | 'tag' | 'minMembers';
  qualificationId?: string;
  tag?: string;
  minCount: number;
}

export interface Team {
  id: string;
  name: string;
  /** "maiden" teams are player-controlled; "enemy" teams are predefined */
  type: 'maiden' | 'enemy';
  /** IDs of members */
  memberIds: string[];
  leaderId?: string;
  compositionChoiceId?: string;
}
