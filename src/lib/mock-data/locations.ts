export type MockLocation = {
  id: string;
  name: string;
  isSubLocation: boolean;
  isCustom: boolean;
};

export const SEED_LOCATION_NAMES = [
  "Antique",
  "Batangas City",
  "Bulacan",
  "Cebu City",
  "Davao",
  "Davao City",
  "Ermita, Metro Manila",
  "Head Office - Puerto Princesa City",
  "Head office Puerto Princesa City, Palawan",
  "Iloilo City",
  "Laguna",
  "Metro Manila",
  "Puerto Princesa City",
  "Roxas City Btranch",
] as const;

function seedId(name: string) {
  return `loc-seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function buildSeedLocations(): MockLocation[] {
  return SEED_LOCATION_NAMES.map((name) => ({
    id: seedId(name),
    name,
    isSubLocation: false,
    isCustom: false,
  }));
}
