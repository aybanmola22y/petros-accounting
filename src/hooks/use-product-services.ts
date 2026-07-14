"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { MockProductService } from "@/lib/mock-data/products-services";
import {
  getProductServicesSnapshot,
  replaceProductServicesInStore,
  subscribeMockStore,
} from "@/lib/mock-data";

const EMPTY_PRODUCT_SERVICES: MockProductService[] = [];

export function useProductServices() {
  const productServices = useSyncExternalStore(
    subscribeMockStore,
    getProductServicesSnapshot,
    () => EMPTY_PRODUCT_SERVICES,
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/product-services");
      const payload = (await response.json()) as {
        productServices?: MockProductService[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load products and services.");
      }
      replaceProductServicesInStore(payload.productServices ?? []);
    } catch (error) {
      console.warn("Could not load products and services from Supabase.", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { productServices, refresh };
}
