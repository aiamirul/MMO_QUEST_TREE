/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { MetaRecord } from '../types';

const BASE_URL = import.meta.env.VITE_META_API_URL || "https://www.shabpltsystem.com/app/sanctum_app/api";
const UUID = import.meta.env.VITE_WORKAREA_UUID || "57602f3a-f422-4f0b-8628-f6d512c6ef9a";
const API_KEY = import.meta.env.VITE_WORKAREA_API_KEY || "WA-57602F3A-1766452056145-ENQZJW24";

const API_ROOT = `${BASE_URL}/meta_api/${UUID}/${API_KEY}`;

export const apiService = {
  checkHealth: async () => {
    const url = `${API_ROOT}/`;
    console.log(`[API] GET ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[API] Response:`, data);
    return data;
  },

  getAll: async (): Promise<MetaRecord[]> => {
    const url = `${API_ROOT}/getall`;
    console.log(`[API] GET ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[API] Response items:`, data.length);
    return data;
  },

  getByGroup: async (group: string): Promise<MetaRecord[]> => {
    const url = `${API_ROOT}/datagroup/${group}`;
    console.log(`[API] GET ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[API] Response for ${group}:`, data.length);
    return data;
  },

  save: async (record: MetaRecord) => {
    const url = `${API_ROOT}/save`;
    console.log(`[API] POST ${url}`, record);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    const data = await res.json();
    console.log(`[API] Save Response:`, data);
    return data;
  },

  delete: async (datakey: string) => {
    const url = `${API_ROOT}/delete/${datakey}`;
    console.log(`[API] DELETE ${url}`);
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    console.log(`[API] Delete Response:`, data);
    return data;
  }
};
