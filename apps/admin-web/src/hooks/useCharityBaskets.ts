import { useState } from 'react';
import type { CharityBasket, BasketItem } from '../types';

const INITIAL_BASKETS: CharityBasket[] = [
  {
    id: 'basket-1',
    name: 'Johnson Family Holiday Basket',
    type: 'holiday',
    description: 'Christmas basket for the Johnson family',
    recipientName: 'Johnson Family',
    status: 'collecting',
    targetDate: '2025-12-20',
    createdAt: new Date().toISOString(),
    createdBy: 'Admin',
    items: [
      {
        id: 'item-1',
        basketId: 'basket-1',
        name: 'Canned vegetables (assorted)',
        category: 'food',
        quantity: 6,
        unit: 'cans',
        estimatedValue: 12,
        donorName: 'Smith Family',
        donatedAt: new Date().toISOString(),
      },
    ],
    totalValue: 12,
  },
];

export function useCharityBaskets() {
  const [baskets, setBaskets] = useState<CharityBasket[]>(INITIAL_BASKETS);

  const createBasket = (basket: Omit<CharityBasket, 'id' | 'createdAt' | 'items' | 'totalValue'>) => {
    const newBasket: CharityBasket = {
      ...basket,
      id: `basket-${Date.now()}`,
      createdAt: new Date().toISOString(),
      items: [],
      totalValue: 0,
    };
    setBaskets((prev) => [...prev, newBasket]);
  };

  const updateBasket = (id: string, updates: Partial<CharityBasket>) => {
    setBaskets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const deleteBasket = (id: string) => {
    setBaskets((prev) => prev.filter((b) => b.id !== id));
  };

  const addItem = (basketId: string, item: Omit<BasketItem, 'id' | 'basketId' | 'donatedAt'>) => {
    const newItem: BasketItem = {
      ...item,
      id: `item-${Date.now()}`,
      basketId,
      donatedAt: new Date().toISOString(),
    };

    setBaskets((prev) =>
      prev.map((b) => {
        if (b.id === basketId) {
          const items = [...b.items, newItem];
          const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0) * i.quantity, 0);
          return { ...b, items, totalValue };
        }
        return b;
      })
    );
  };

  const removeItem = (basketId: string, itemId: string) => {
    setBaskets((prev) =>
      prev.map((b) => {
        if (b.id === basketId) {
          const items = b.items.filter((i) => i.id !== itemId);
          const totalValue = items.reduce((sum, i) => sum + (i.estimatedValue || 0) * i.quantity, 0);
          return { ...b, items, totalValue };
        }
        return b;
      })
    );
  };

  const distributeBasket = (basketId: string) => {
    setBaskets((prev) =>
      prev.map((b) =>
        b.id === basketId
          ? { ...b, status: 'distributed' as const, distributedDate: new Date().toISOString() }
          : b
      )
    );
  };

  return {
    baskets,
    createBasket,
    updateBasket,
    deleteBasket,
    addItem,
    removeItem,
    distributeBasket,
  };
}
