import type { Bonus } from './stats';

export interface Qualification {
  id: string;
  name: string;
  description: string;
  bonuses: Bonus[];
  /** Special ability key handled in combat engine */
  ability?: string;
}
