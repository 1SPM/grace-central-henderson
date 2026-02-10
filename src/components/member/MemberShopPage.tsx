import { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Heart,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Tag,
  Truck,
  CreditCard,
  Check,
  Package,
} from 'lucide-react';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'apparel' | 'books' | 'music' | 'accessories' | 'kids' | 'home' | 'seasonal';
  image?: string;
  sizes?: string[];
  colors?: string[];
  inStock: boolean;
  featured: boolean;
  newArrival: boolean;
}

interface CartItem {
  itemId: string;
  quantity: number;
  size?: string;
  color?: string;
}

interface MemberShopPageProps {
  churchName?: string;
  personId?: string;
}

const categoryLabels: Record<ShopItem['category'], string> = {
  apparel: 'Apparel',
  books: 'Books & Bibles',
  music: 'Music & Media',
  accessories: 'Accessories',
  kids: 'Kids & Youth',
  home: 'Home & Decor',
  seasonal: 'Seasonal',
};

// Sample shop items - in production, these would come from a database
const sampleItems: ShopItem[] = [
  {
    id: 'item-1',
    name: 'Church Logo T-Shirt',
    description: 'Comfortable cotton t-shirt with embroidered church logo',
    price: 25.00,
    category: 'apparel',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    colors: ['Navy', 'White', 'Gray'],
    inStock: true,
    featured: true,
    newArrival: false,
  },
  {
    id: 'item-2',
    name: 'Faith & Grace Devotional',
    description: '365-day devotional book for spiritual growth',
    price: 18.99,
    category: 'books',
    inStock: true,
    featured: true,
    newArrival: true,
  },
  {
    id: 'item-3',
    name: 'Worship Album - "Amazing Grace"',
    description: 'Original worship music from our church choir',
    price: 12.00,
    category: 'music',
    inStock: true,
    featured: false,
    newArrival: true,
  },
  {
    id: 'item-4',
    name: 'Church Logo Mug',
    description: 'Ceramic mug with church logo - 12oz',
    price: 15.00,
    category: 'accessories',
    colors: ['White', 'Black'],
    inStock: true,
    featured: false,
    newArrival: false,
  },
  {
    id: 'item-5',
    name: 'Kids Bible Story Book',
    description: 'Illustrated Bible stories for children ages 4-8',
    price: 14.99,
    category: 'kids',
    inStock: true,
    featured: false,
    newArrival: false,
  },
  {
    id: 'item-6',
    name: 'Church Hoodie',
    description: 'Warm fleece hoodie with church name',
    price: 45.00,
    category: 'apparel',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    colors: ['Navy', 'Black'],
    inStock: true,
    featured: true,
    newArrival: false,
  },
  {
    id: 'item-7',
    name: 'Scripture Wall Art',
    description: 'Beautiful framed scripture print - "Be Still and Know"',
    price: 35.00,
    category: 'home',
    inStock: true,
    featured: false,
    newArrival: true,
  },
  {
    id: 'item-8',
    name: 'VBS T-Shirt 2024',
    description: 'Vacation Bible School commemorative shirt',
    price: 15.00,
    category: 'seasonal',
    sizes: ['Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L'],
    inStock: true,
    featured: false,
    newArrival: true,
  },
  {
    id: 'item-9',
    name: 'Prayer Journal',
    description: 'Guided prayer journal with scripture prompts',
    price: 12.99,
    category: 'books',
    inStock: true,
    featured: false,
    newArrival: false,
  },
  {
    id: 'item-10',
    name: 'Kids Youth Group Cap',
    description: 'Adjustable baseball cap for youth ministry',
    price: 18.00,
    category: 'kids',
    colors: ['Blue', 'Pink', 'Black'],
    inStock: true,
    featured: false,
    newArrival: false,
  },
];

export function MemberShopPage({ churchName = 'Grace Church' }: MemberShopPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ShopItem['category'] | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Filter items
  const filteredItems = useMemo(() => {
    return sampleItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory && item.inStock;
    });
  }, [searchTerm, categoryFilter]);

  // Featured items
  const featuredItems = useMemo(() => sampleItems.filter(item => item.featured), []);

  // Cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, cartItem) => {
      const item = sampleItems.find(i => i.id === cartItem.itemId);
      return sum + (item?.price || 0) * cartItem.quantity;
    }, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (itemId: string, size?: string, color?: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.itemId === itemId && c.size === size && c.color === color);
      if (existing) {
        return prev.map(c =>
          c.itemId === itemId && c.size === size && c.color === color
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { itemId, quantity: 1, size, color }];
    });
    setSelectedItem(null);
    setSelectedSize('');
    setSelectedColor('');
  };

  const updateCartQuantity = (itemId: string, size: string | undefined, color: string | undefined, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.itemId === itemId && c.size === size && c.color === color) {
          const newQty = c.quantity + delta;
          return newQty <= 0 ? null : { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (itemId: string, size?: string, color?: string) => {
    setCart(prev => prev.filter(c => !(c.itemId === itemId && c.size === size && c.color === color)));
  };

  const toggleFavorite = (itemId: string) => {
    setFavorites(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleCheckout = () => {
    // In production, this would integrate with payment processing
    setShowCheckout(true);
    setShowCart(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{churchName} Shop</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Support our ministry with every purchase</p>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Featured Items Banner */}
      {featuredItems.length > 0 && categoryFilter === 'all' && searchTerm === '' && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4" />
            <span className="font-semibold text-sm">Featured Items</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {featuredItems.slice(0, 3).map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="flex-shrink-0 bg-white/10 backdrop-blur rounded-lg p-3 min-w-[140px] text-left hover:bg-white/20 transition-colors"
              >
                <div className="w-full h-16 bg-white/20 rounded mb-2 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-white/60" />
                </div>
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs opacity-80">{formatCurrency(item.price)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ShopItem['category'] | 'all')}
            className="pl-9 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm appearance-none"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No products found</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Product Image Placeholder */}
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-500" />
                {item.newArrival && (
                  <span className="absolute top-2 left-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    New
                  </span>
                )}
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full"
                >
                  <Heart
                    className={`w-4 h-4 ${favorites.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                  />
                </button>
              </div>
              {/* Product Info */}
              <div className="p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{categoryLabels[item.category]}</p>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{item.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 h-8">{item.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(item.price)}</span>
                  <button
                    onClick={() => {
                      if (item.sizes || item.colors) {
                        setSelectedItem(item);
                      } else {
                        addToCart(item.id);
                      }
                    }}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setSelectedItem(null)}>
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedItem.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{categoryLabels[selectedItem.category]}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{selectedItem.description}</p>

            {/* Size Selection */}
            {selectedItem.sizes && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Size</label>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        selectedSize === size
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {selectedItem.colors && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        selectedColor === color
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(selectedItem.price)}</span>
              <button
                onClick={() => addToCart(selectedItem.id, selectedSize || undefined, selectedColor || undefined)}
                disabled={(selectedItem.sizes && !selectedSize) || (selectedItem.colors && !selectedColor)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowCart(false)}>
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Cart Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Shopping Cart ({cartCount})</h3>
              <button onClick={() => setShowCart(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Your cart is empty</p>
                </div>
              ) : (
                cart.map((cartItem, index) => {
                  const item = sampleItems.find(i => i.id === cartItem.itemId);
                  if (!item) return null;
                  return (
                    <div key={`${cartItem.itemId}-${cartItem.size}-${cartItem.color}-${index}`} className="flex gap-3">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.name}</h4>
                        {(cartItem.size || cartItem.color) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {[cartItem.size, cartItem.color].filter(Boolean).join(' / ')}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(cartItem.itemId, cartItem.size, cartItem.color, -1)}
                              className="p-1 bg-gray-100 dark:bg-gray-700 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-6 text-center">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(cartItem.itemId, cartItem.size, cartItem.color, 1)}
                              className="p-1 bg-gray-100 dark:bg-gray-700 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(item.price * cartItem.quantity)}
                            </span>
                            <button
                              onClick={() => removeFromCart(cartItem.itemId, cartItem.size, cartItem.color)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(cartTotal)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Proceed to Checkout
                </button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  <Truck className="w-3 h-3 inline mr-1" />
                  Free pickup at church office
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Success Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Order Placed!</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your order has been received. You&apos;ll receive a confirmation email shortly.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4 text-left">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
                <Package className="w-4 h-4" />
                <span>Order Total: {formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Truck className="w-4 h-4" />
                <span>Pickup at church office</span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowCheckout(false);
                setCart([]);
              }}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
