import { StyleSheet, Text, View, FlatList, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ShoppingCart, Trash2 } from 'lucide-react-native';
import { RootStackNavigationProp } from '../navigation/types';
import { useCart } from '@/lib/cart';
import { getShop } from '@/lib/data';
import { saveOrder, newOrderId, buildLines } from '@/lib/orders';

export default function CartScreen() {
  const navigation = useNavigation<RootStackNavigationProp<'Cart'>>();
  const { lines, subtotal, clear, setQty, itemCount, shopId } = useCart();

  const handleCheckout = () => {
    if (!shopId) return;
    const shop = getShop(shopId);
    if (!shop) return;

    const deliveryFee = subtotal >= shop.freeAbove ? 0 : shop.deliveryFee;
    const handling = 9;
    const total = subtotal + deliveryFee + handling;

    const orderId = newOrderId();

    saveOrder({
      id: orderId,
      shopId: shop.id,
      shopName: shop.name,
      shopEmoji: shop.emoji,
      lines: buildLines(lines),
      subtotal,
      deliveryFee,
      handling,
      total,
      paymentMethod: "Cash on Delivery",
      address: "Home · 12, 5th Cross, Koramangala, Bengaluru",
      etaMinutes: shop.etaMinutes,
      placedAt: Date.now(),
      status: "placed",
    });

    Alert.alert(
      "Order Placed 🎉",
      `Thank you for shopping! Your order #${orderId} is being processed.`,
      [
        {
          text: "OK",
          onPress: () => {
            clear();
            navigation.navigate('HomeTabs', { screen: 'Orders' });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <ArrowLeft size={20} color="#0D1F16" />
        </Pressable>
        <Text style={styles.headerTitle}>My Cart</Text>
        <Pressable 
          onPress={clear} 
          disabled={lines.length === 0}
          style={[styles.iconButton, lines.length === 0 && styles.disabledButton]}
        >
          <Trash2 size={16} color={lines.length === 0 ? "#CBD5E1" : "#EF4444"} />
        </Pressable>
      </View>

      {lines.length === 0 ? (
        // Empty State
        <View style={styles.emptyContainer}>
          <ShoppingCart size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add items from shops near you to start checkout.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.shopButton}>
            <Text style={styles.shopButtonText}>Browse Shops</Text>
          </Pressable>
        </View>
      ) : (
        // Cart content
        <View style={styles.content}>
          <FlatList
            data={lines}
            keyExtractor={(item) => item.product.id}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <Text style={styles.itemEmoji}>{item.product.emoji || '📦'}</Text>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.product.price} each</Text>
                </View>

                {/* Counter */}
                <View style={styles.counter}>
                  <Pressable onPress={() => setQty(item.product.id, item.quantity - 1)} style={styles.counterBtn}>
                    <Text style={styles.counterBtnText}>-</Text>
                  </Pressable>
                  <Text style={styles.counterText}>{item.quantity}</Text>
                  <Pressable onPress={() => setQty(item.product.id, item.quantity + 1)} style={styles.counterBtn}>
                    <Text style={styles.counterBtnText}>+</Text>
                  </Pressable>
                </View>

                <Text style={styles.itemTotal}>₹{item.product.price * item.quantity}</Text>
              </View>
            )}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
          />

          {/* Pricing summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({itemCount} items)</Text>
              <Text style={styles.summaryValue}>₹{subtotal}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Charge</Text>
              <Text style={styles.summaryValueFree}>FREE</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{subtotal}</Text>
            </View>

            <Pressable onPress={handleCheckout} style={styles.checkoutBtn}>
              <Text style={styles.checkoutBtnText}>Place Order (COD)</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  disabledButton: {
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1F16',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1F16',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  shopButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#259F56',
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    gap: 10,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
  },
  itemEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1F16',
  },
  itemPrice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginRight: 14,
  },
  counterBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D1F16',
    minWidth: 16,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1F16',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    paddingBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D1F16',
  },
  summaryValueFree: {
    fontSize: 12,
    fontWeight: '700',
    color: '#259F56',
  },
  totalRow: {
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 6,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1F16',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D1F16',
  },
  checkoutBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#259F56',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
