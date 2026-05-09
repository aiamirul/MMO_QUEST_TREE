/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Legend, LinearScale, Tooltip, PointElement, LineElement, Title, CategoryScale } from 'chart.js';

export interface QuestAttributes {
  ITEM1?: string;
  ITEM1_QTY?: number;
  PRODUCT1?: string;
  PRODUCT_QTY1?: number;
  REP_NAME: string;
  REP_COST: number;
  COINS: number;
  CD: number;
  REWARD_REP_TYPE1: string;
  REWARD_REP_AMT1: number;
  REWARD_REP_TYPE2?: string;
  REWARD_REP_AMT2?: number;
  LOOPMESSAGE: string;
  description: string;
}

export interface Quest {
  id: string;
  INHERIT: string;
  allattrib: QuestAttributes;
}

export interface ReputationState {
  [faction: string]: number;
}

export interface MetaRecord {
  datakey: string;
  datagroup: string;
  datatype: 'SYSTEM' | 'APP' | 'USER' | 'PUBLIC' | 'CUSTOM';
  metadata: any;
}
