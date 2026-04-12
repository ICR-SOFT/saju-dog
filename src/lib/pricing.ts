import { supabase } from './supabase';

export interface PricingPlan {
  id: string;
  bones: number;
  price: number;
  badge: string | null;
  sort_order: number;
}

export interface ServiceCost {
  service_type: string;
  bones: number;
}

let cachedPlans: PricingPlan[] | null = null;
let cachedCosts: Record<string, number> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

export async function getPricingPlans(): Promise<PricingPlan[]> {
  if (cachedPlans && Date.now() - cacheTime < CACHE_TTL) return cachedPlans;
  const { data } = await supabase
    .from('pricing_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  cachedPlans = data || [];
  cacheTime = Date.now();
  return cachedPlans;
}

export async function getServiceCosts(): Promise<Record<string, number>> {
  if (cachedCosts && Date.now() - cacheTime < CACHE_TTL) return cachedCosts;
  const { data } = await supabase
    .from('service_costs')
    .select('service_type, bones')
    .eq('is_active', true);
  cachedCosts = {};
  if (data) {
    for (const row of data) {
      cachedCosts[row.service_type] = row.bones;
    }
  }
  cacheTime = Date.now();
  return cachedCosts;
}

export function getServiceCost(costs: Record<string, number>, serviceType: string): number {
  return costs[serviceType] ?? 4;
}
